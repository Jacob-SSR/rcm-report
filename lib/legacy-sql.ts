import type { LegacyReport, ReferenceReportId } from './legacy-reports';

const referenceSql: Record<ReferenceReportId, string> = {
  MENU01D01D04: `
    SELECT ptt.pttype, ptt.name, ptt.hipdata_code, n.icode, n.name AS namenondrugitem,
      psc.visit_type, n.income, i.name AS nameincome, n.price
    FROM pttype_service_charge psc
    LEFT JOIN pttype ptt ON ptt.pttype = psc.pttype
    LEFT JOIN nondrugitems n ON n.icode = psc.icode
    LEFT JOIN income i ON i.income = n.income
    WHERE ptt.isuse = 'Y'
    ORDER BY ptt.pttype, n.icode, psc.visit_type
  `,
  MENU01D02D02D03: `
    SELECT inc.income, inc.name, inc.income_sss_group_code, sss.name AS incom_sss_group_name,
      ig.income_group, ig.name AS group_name, inc.group1, ir1.group_name AS group_name1,
      inc.group2, ir2.group_name AS group_name2, inc.group3, ir3.group_name AS group_name3,
      inc.group4, ir4.group_name AS group_name4, inc.drg_group, drg.drg_chrgitem_name AS drg_group_name,
      inc.std_group, std.name AS income_std_group_name, inc.nk2_group, nk2.name AS nk2_group_name,
      inc.income_csmbs_code, csmbs.income_csmbs_name
    FROM income inc
    LEFT JOIN income_group ig ON ig.income_group = inc.income_group
    LEFT JOIN income_report1 ir1 ON ir1.group1 = inc.group1
    LEFT JOIN income_report2 ir2 ON ir2.group_id = inc.group2
    LEFT JOIN income_report3 ir3 ON ir3.group_id = inc.group3
    LEFT JOIN income_report3 ir4 ON ir4.group_id = inc.group4
    LEFT JOIN drg_chrgitem drg ON drg.drg_chrgitem_id = inc.drg_group
    LEFT JOIN income_std_group std ON std.std_group = inc.std_group
    LEFT JOIN income_nk2 nk2 ON nk2.nk2_group = inc.nk2_group
    LEFT JOIN income_sss_group sss ON sss.code = inc.income_sss_group_code
    LEFT JOIN income_csmbs csmbs ON csmbs.income_csmbs_code = inc.income_csmbs_code
    ORDER BY inc.income
  `,
  MENU01D02D02D04: `
    SELECT pip.items_table_code, n.name AS nondrugitems_name, n.paidst,
      pppt.pttype_price_policy_type_name, ppg.pttype_price_group_name, pd.pttype_department_name,
      inc.name AS income_name, ptpt.pttype_items_paid_type_name, pip.price,
      n.price2, n.price3, n.ipd_price, n.ipd_price2, n.ipd_price3
    FROM pttype_items_price pip
    LEFT JOIN nondrugitems n ON n.icode = pip.items_table_code
    LEFT JOIN pttype_items_paid_type ptpt ON ptpt.pttype_items_paid_type_id = pip.pttype_items_paid_type_id
    LEFT JOIN pttype_price_policy_type pppt ON pppt.pttype_price_policy_type_id = pip.pttype_price_policy_type_id
    LEFT JOIN pttype_department pd ON pd.pttype_department_id = pip.pttype_department_id
    LEFT JOIN income inc ON inc.income = pip.income
    LEFT JOIN paidst p ON p.paidst = pip.paidst
    LEFT JOIN pttype_price_group ppg ON ppg.pttype_price_group_id = pip.pttype_price_group_id
    WHERE n.istatus = 'Y'
    ORDER BY pip.items_table_code, pppt.pttype_price_policy_type_name, ppg.pttype_price_group_name,
      pd.pttype_department_name, inc.name, ptpt.pttype_items_paid_type_name, pip.price
  `,
};

export function legacyQuery(report: LegacyReport, dates: { start: string; end: string }) {
  const spec = report.rep;
  if (!spec) return { sql: referenceSql[report.id as ReferenceReportId], args: [] };
  const args = [dates.start, dates.end];
  const conditions = ['r.SendDate >= ?', 'r.SendDate < DATE_ADD(?, INTERVAL 1 DAY)', 'r.SubFund IS NOT NULL'];
  // The legacy IPD detail includes errors, while the OPD detail and summaries omit them.
  if (!(spec.detail && spec.service === 'IPD')) conditions.push('r.ErrorCode IS NULL');
  if (spec.service) conditions.push(spec.service === 'OPD' ? 'r.AN IS NULL' : 'r.AN IS NOT NULL');
  if (spec.right) {
    const isOther = spec.right === 'OTHER';
    const rights = isOther ? (spec.service === 'IPD' ? ['UCS','LGO','WEL','SSS','OFC'] : ['UCS','LGO','WEL','SSS','OFC','SSI','STP'])
      : spec.right === 'UCS' ? (report.id === 'MENU05D01D01D03D02' ? ['UCS'] : ['UCS','WEL'])
      : spec.right === 'SSS' ? ['SSS','SSI'] : [spec.right];
    conditions.push(`r.MainInscl ${isOther ? 'NOT ' : ''}IN (${rights.map(() => '?').join(',')})`);
    args.push(...rights);
  }
  const where = conditions.join(' AND ');
  if (spec.detail) {
    const columns = report.columns.map(column => `r.${column} AS \`${column}\``).join(', ');
    return { sql: `SELECT ${columns} FROM repdata r WHERE ${where} ORDER BY r.YYMM, r.ID`, args };
  }
  // The original groups by SubFund alone. MIN preserves a stable displayed fund for mixed groups.
  return { sql: `SELECT MIN(r.Fund) AS fund, r.SubFund, COUNT(r.ID) AS cases, SUM(r.Compensated) AS total
    FROM repdata r WHERE ${where} GROUP BY r.SubFund ORDER BY r.SubFund`, args };
}
