import type { Content, StyleDictionary } from 'pdfmake/interfaces';
import { ReportPeriod, ReportStatus } from '../../../common/enums/reports.type';

export function buildReportHeader(
  title: string,
  name: string,
  period: ReportPeriod,
  status: ReportStatus,
  dateDelivered: Date | null,
): Content[] {
  return [
    { text: title, style: 'reportTitle' },
    { text: name, style: 'reportSubTitle' },
    {
      columns: [
        { text: `Period: ${period}`, style: 'meta' },
        { text: `Status: ${status}`, style: 'meta' },
        {
          text: `Delivered: ${dateDelivered ? dateDelivered.toLocaleString() : '—'}`,
          style: 'meta',
        },
      ],
      marginBottom: 16,
    },
    {
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 515,
          y2: 0,
          lineWidth: 1,
          lineColor: '#e0e0e0',
        },
      ],
      marginBottom: 12,
    },
  ];
}

export function buildSectionTitle(text: string): Content {
  return { text, style: 'sectionHeader' };
}

export function buildMetricRow(label: string, value: string | number): Content {
  return {
    columns: [
      { text: label, bold: true, width: '60%' },
      { text: String(value), width: '40%', alignment: 'right' },
    ],
    marginBottom: 6,
  };
}

export function buildAssumptionsTable(
  rows: [string, string | number][],
): Content {
  return {
    table: {
      widths: ['60%', '40%'],
      body: rows.map(([label, value]) => [
        { text: label, style: 'tableLabel' },
        { text: String(value), alignment: 'right' },
      ]),
    },
    layout: 'lightHorizontalLines',
    marginBottom: 12,
  };
}

export const STYLES: StyleDictionary = {
  reportTitle: {
    fontSize: 20,
    bold: true,
    color: '#2c3e50',
    marginBottom: 4,
  },
  reportSubTitle: {
    fontSize: 13,
    color: '#555555',
    marginBottom: 8,
  },
  meta: {
    fontSize: 10,
    color: '#777777',
  },
  sectionHeader: {
    fontSize: 14,
    bold: true,
    color: '#2c3e50',
    marginTop: 16,
    marginBottom: 8,
    decoration: 'underline',
  },
  subSectionHeader: {
    fontSize: 12,
    bold: true,
    color: '#444444',
    marginBottom: 6,
  },
  tableLabel: {
    bold: true,
    fontSize: 10,
  },
};
