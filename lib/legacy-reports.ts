// Ported from the SELECT-only entries in RCM161169/RCM/SQL4RCM.SQL.
// IDs link each result to its original menu. These are HOSxP reference reports.
const referenceReports = [
  {
    id: 'MENU01D01D04',
    title: '1.1.4 สรุปสิทธิการรักษากับค่าธรรมเนียมสิทธิ',
    columns: ['pttype', 'name', 'hipdata_code', 'icode', 'namenondrugitem', 'visit_type', 'income', 'nameincome', 'price'],
  },
  {
    id: 'MENU01D02D02D03',
    title: '1.2.2.3 รายงานสรุปหมวดบัญชีค่ารักษา',
    columns: ['income', 'name', 'income_sss_group_code', 'incom_sss_group_name', 'income_group', 'group_name', 'group1', 'group_name1', 'group2', 'group_name2', 'group3', 'group_name3', 'group4', 'group_name4', 'drg_group', 'drg_group_name', 'std_group', 'income_std_group_name', 'nk2_group', 'nk2_group_name', 'income_csmbs_code', 'income_csmbs_name'],
  },
  {
    id: 'MENU01D02D02D04',
    title: '1.2.2.4 รายงานสรุปค่ารักษาพยาบาล V4',
    columns: ['items_table_code', 'nondrugitems_name', 'paidst', 'pttype_price_policy_type_name', 'pttype_price_group_name', 'pttype_department_name', 'income_name', 'pttype_items_paid_type_name', 'price', 'price2', 'price3', 'ipd_price', 'ipd_price2', 'ipd_price3'],
  },
] as const;

const files = ['UCS', 'OFC', 'LGO', 'SSS', 'STP', 'OTHER'] as const;
type RepRight = (typeof files)[number];
export type RepSpecification = { service?: 'OPD' | 'IPD'; right?: RepRight; detail?: true; numbered?: true };
export type LegacyReport = {
  id: string;
  title: string;
  columns: readonly string[];
  rep?: RepSpecification;
};

const branch = 'MENU05D01D01D03';
const allColumns = ['fund', 'SubFund', 'คน', 'total'];
const detailColumns = ['YYMM', 'YearBudget', 'HN', 'Department', 'AdmDate', 'DchDate', 'SendDate', 'Income', 'Collected', 'Compensated', 'MainInscl', 'Fund', 'SubFund', 'ProjectCode', 'FileName', 'HCode', 'HSub', 'Remark'];
function serviceReports(service: 'OPD' | 'IPD'): LegacyReport[] {
  const isOpd = service === 'OPD';
  const parent = isOpd ? 'D02' : 'D03';
  const number = isOpd ? '5.1.1.3.2' : '5.1.1.3.3';
  const base = branch + parent;
  return [
    {
      id: base,
      title: isOpd ? '5.1.1.3.2.1 รายงานสรุปกองทุน OPD ทุกสิทธิ จาก REP' : '5.1.1.3.3 รายงานสรุปกองทุน IPD ทุกสิทธิ จาก REP',
      columns: ['no', ...allColumns], rep: { service, ...(isOpd && { right: 'UCS' as const }), numbered: true },
    },
    {
      id: base + 'D01', title: `${number}.1 รายงานรายชื่อตามกองทุน ${service} จาก REP`,
      columns: isOpd ? detailColumns : [...detailColumns.slice(0, 3), 'AN', ...detailColumns.slice(3)],
      rep: { service, detail: true },
    },
    ...files.map((right, index): LegacyReport => ({
      id: base + 'D0' + (index + 2),
      title: `${number}.${isOpd && right === 'OTHER' ? 6 : index + 2} รายงานสรุปกองทุน ${service} สิทธิ ${right === 'OTHER' ? 'อื่น ๆ' : right} จาก REP`,
      columns: ['no', 'fund', 'SubFund', 'เคส', 'total'],
      rep: { service, right, numbered: true },
    })),
  ];
}
export const legacyReports: LegacyReport[] = [
  ...referenceReports,
  { id: branch, title: '5.1.1.3 รายงานสรุปตามกองทุน จาก REP', columns: allColumns, rep: {} },
  { id: branch + 'D01', title: '5.1.1.3.1 รายงานสรุปตามกองทุนรวมผู้ป่วยนอกใน จาก REP', columns: allColumns, rep: {} },
  ...serviceReports('OPD'),
  ...serviceReports('IPD'),
];

export type ReferenceReportId = (typeof referenceReports)[number]['id'];
