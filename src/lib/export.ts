import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { ProjectWithDetails, ProjectMetrics } from '../types';

type ProjectWithMetrics = ProjectWithDetails & { metrics: ProjectMetrics };

// PDF Export for single project
export function exportProjectPDF(project: ProjectWithDetails, metrics: ProjectMetrics) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(project.name, 14, 20);

  // Subtitle
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`${project.client} • ${project.project_type} • ${project.status}`, 14, 28);

  // Key Metrics
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Key Metrics', 14, 42);

  autoTable(doc, {
    startY: 46,
    head: [['Metric', 'Value']],
    body: [
      ['Total Value', `€${metrics.totalValue.toLocaleString()}`],
      ['Hours (Est / Act)', `${metrics.estimatedHours}h / ${metrics.actualHours}h`],
      ['Hours Variance', `${metrics.hoursVariancePercent >= 0 ? '+' : ''}${metrics.hoursVariancePercent.toFixed(1)}%`],
      ['Estimated Margin', `${metrics.estimatedMargin.toFixed(1)}%`],
      ['Actual Margin', `${metrics.actualMargin.toFixed(1)}%`],
      ['Margin Delta', `${metrics.marginDelta >= 0 ? '+' : ''}${metrics.marginDelta.toFixed(1)}%`],
      ['Planned Rate', `€${metrics.estimatedHourlyRate.toFixed(0)}/h`],
      ['Actual Rate', `€${metrics.actualHourlyRate.toFixed(0)}/h`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
  });

  // Hours by Profile
  const profileY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Hours by Profile', 14, profileY);

  const profileData = project.profile_hours
    .filter(ph => ph.estimated_hours > 0 || ph.actual_hours > 0)
    .map(ph => {
      const variance = ph.estimated_hours > 0
        ? ((ph.actual_hours - ph.estimated_hours) / ph.estimated_hours * 100).toFixed(1)
        : '0';
      return [ph.profile, `${ph.estimated_hours}h`, `${ph.actual_hours}h`, `${variance}%`];
    });

  if (profileData.length > 0) {
    autoTable(doc, {
      startY: profileY + 4,
      head: [['Profile', 'Estimated', 'Actual', 'Variance']],
      body: profileData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });
  }

  // External Costs
  const costsY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('External Costs', 14, costsY);

  const costData = project.external_costs.map(cost => [
    cost.description,
    cost.cost_type === 'contractor' ? 'Contractor' : 'Tool/License',
    `€${cost.estimated_cost.toLocaleString()}`,
    `€${cost.actual_cost.toLocaleString()}`,
  ]);

  if (costData.length > 0) {
    autoTable(doc, {
      startY: costsY + 4,
      head: [['Description', 'Type', 'Planned', 'Actual']],
      body: costData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });
  }

  // Check if we need a new page for retrospective
  let retroY = (doc as any).lastAutoTable.finalY + 10;
  if (retroY > 240) {
    doc.addPage();
    retroY = 20;
  }

  // Retrospective
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Retrospective', 14, retroY);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  if (project.went_well) {
    doc.setFont('helvetica', 'bold');
    doc.text('What went well:', 14, retroY + 8);
    doc.setFont('helvetica', 'normal');
    const wellLines = doc.splitTextToSize(project.went_well, pageWidth - 28);
    doc.text(wellLines, 14, retroY + 14);
    retroY += 14 + wellLines.length * 5;
  }

  if (project.went_wrong) {
    doc.setFont('helvetica', 'bold');
    doc.text('What went wrong:', 14, retroY + 4);
    doc.setFont('helvetica', 'normal');
    const wrongLines = doc.splitTextToSize(project.went_wrong, pageWidth - 28);
    doc.text(wrongLines, 14, retroY + 10);
    retroY += 10 + wrongLines.length * 5;
  }

  if (project.scope_creep) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('⚠ Scope Creep:', 14, retroY + 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    if (project.scope_creep_notes) {
      const creepLines = doc.splitTextToSize(project.scope_creep_notes, pageWidth - 28);
      doc.text(creepLines, 14, retroY + 10);
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Generated on ${new Date().toLocaleDateString()} • Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  doc.save(`${project.name.replace(/[^a-z0-9]/gi, '_')}_retrospective.pdf`);
}

// Excel Export for all projects
export function exportProjectsExcel(projects: ProjectWithMetrics[]) {
  const workbook = XLSX.utils.book_new();

  // Projects Overview Sheet
  const overviewData = projects.map(p => ({
    'Project Name': p.name,
    'Client': p.client,
    'Type': p.project_type,
    'Status': p.status,
    'Outcome': p.project_outcome || '',
    'Total Value (€)': p.metrics.totalValue,
    'Est. Hours': p.metrics.estimatedHours,
    'Actual Hours': p.metrics.actualHours,
    'Hours Variance (%)': Math.round(p.metrics.hoursVariancePercent * 10) / 10,
    'Est. Margin (%)': Math.round(p.metrics.estimatedMargin * 10) / 10,
    'Actual Margin (%)': Math.round(p.metrics.actualMargin * 10) / 10,
    'Margin Delta (%)': Math.round(p.metrics.marginDelta * 10) / 10,
    'Planned Rate (€/h)': Math.round(p.metrics.estimatedHourlyRate),
    'Actual Rate (€/h)': Math.round(p.metrics.actualHourlyRate),
    'Scope Creep': p.scope_creep ? 'Yes' : 'No',
  }));

  const overviewSheet = XLSX.utils.json_to_sheet(overviewData);
  XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Projects Overview');

  // Hours by Profile Sheet
  const hoursData: any[] = [];
  for (const p of projects) {
    for (const ph of p.profile_hours) {
      if (ph.estimated_hours > 0 || ph.actual_hours > 0) {
        hoursData.push({
          'Project': p.name,
          'Profile': ph.profile,
          'Estimated Hours': ph.estimated_hours,
          'Actual Hours': ph.actual_hours,
          'Variance': ph.actual_hours - ph.estimated_hours,
          'Variance (%)': ph.estimated_hours > 0
            ? Math.round((ph.actual_hours - ph.estimated_hours) / ph.estimated_hours * 1000) / 10
            : 0,
        });
      }
    }
  }

  if (hoursData.length > 0) {
    const hoursSheet = XLSX.utils.json_to_sheet(hoursData);
    XLSX.utils.book_append_sheet(workbook, hoursSheet, 'Hours by Profile');
  }

  // External Costs Sheet
  const costsData: any[] = [];
  for (const p of projects) {
    for (const cost of p.external_costs) {
      costsData.push({
        'Project': p.name,
        'Description': cost.description,
        'Type': cost.cost_type === 'contractor' ? 'Contractor' : 'Tool/License',
        'Planned (€)': cost.estimated_cost,
        'Actual (€)': cost.actual_cost,
        'Variance (€)': cost.actual_cost - cost.estimated_cost,
      });
    }
  }

  if (costsData.length > 0) {
    const costsSheet = XLSX.utils.json_to_sheet(costsData);
    XLSX.utils.book_append_sheet(workbook, costsSheet, 'External Costs');
  }

  // Retrospective Notes Sheet
  const retroData = projects
    .filter(p => p.went_well || p.went_wrong || p.scope_creep_notes)
    .map(p => ({
      'Project': p.name,
      'What Went Well': p.went_well || '',
      'What Went Wrong': p.went_wrong || '',
      'Scope Creep': p.scope_creep ? 'Yes' : 'No',
      'Scope Creep Notes': p.scope_creep_notes || '',
    }));

  if (retroData.length > 0) {
    const retroSheet = XLSX.utils.json_to_sheet(retroData);
    XLSX.utils.book_append_sheet(workbook, retroSheet, 'Retrospective Notes');
  }

  XLSX.writeFile(workbook, `projects_export_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Analytics Excel Export
export function exportAnalyticsExcel(
  projects: ProjectWithMetrics[],
  profileStats: Record<string, { estimated: number; actual: number }>
) {
  const workbook = XLSX.utils.book_new();

  // Summary Sheet
  const totalValue = projects.reduce((sum, p) => sum + p.metrics.totalValue, 0);
  const avgHoursVariance = projects.length > 0
    ? projects.reduce((sum, p) => sum + p.metrics.hoursVariancePercent, 0) / projects.length
    : 0;
  const avgMarginDelta = projects.length > 0
    ? projects.reduce((sum, p) => sum + p.metrics.marginDelta, 0) / projects.length
    : 0;
  const scopeCreepCount = projects.filter(p => p.scope_creep).length;

  const summaryData = [
    { 'Metric': 'Total Projects', 'Value': projects.length },
    { 'Metric': 'Active Projects', 'Value': projects.filter(p => p.status === 'active').length },
    { 'Metric': 'Completed Projects', 'Value': projects.filter(p => p.status === 'completed').length },
    { 'Metric': 'Total Revenue (€)', 'Value': totalValue },
    { 'Metric': 'Avg Hours Variance (%)', 'Value': Math.round(avgHoursVariance * 10) / 10 },
    { 'Metric': 'Avg Margin Delta (%)', 'Value': Math.round(avgMarginDelta * 10) / 10 },
    { 'Metric': 'Scope Creep Rate (%)', 'Value': projects.length > 0 ? Math.round(scopeCreepCount / projects.length * 1000) / 10 : 0 },
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Profile Performance Sheet
  const profileData = Object.entries(profileStats).map(([profile, stats]) => ({
    'Profile': profile,
    'Total Estimated Hours': stats.estimated,
    'Total Actual Hours': stats.actual,
    'Variance (h)': stats.actual - stats.estimated,
    'Variance (%)': stats.estimated > 0
      ? Math.round((stats.actual - stats.estimated) / stats.estimated * 1000) / 10
      : 0,
  }));

  const profileSheet = XLSX.utils.json_to_sheet(profileData);
  XLSX.utils.book_append_sheet(workbook, profileSheet, 'Profile Performance');

  // All Projects Detail
  const projectsData = projects.map(p => ({
    'Project': p.name,
    'Client': p.client,
    'Type': p.project_type,
    'Status': p.status,
    'Total Value (€)': p.metrics.totalValue,
    'Est. Hours': p.metrics.estimatedHours,
    'Actual Hours': p.metrics.actualHours,
    'Hours Variance (%)': Math.round(p.metrics.hoursVariancePercent * 10) / 10,
    'Est. Margin (%)': Math.round(p.metrics.estimatedMargin * 10) / 10,
    'Actual Margin (%)': Math.round(p.metrics.actualMargin * 10) / 10,
    'Scope Creep': p.scope_creep ? 'Yes' : 'No',
  }));

  const projectsSheet = XLSX.utils.json_to_sheet(projectsData);
  XLSX.utils.book_append_sheet(workbook, projectsSheet, 'Projects');

  XLSX.writeFile(workbook, `analytics_export_${new Date().toISOString().split('T')[0]}.xlsx`);
}
