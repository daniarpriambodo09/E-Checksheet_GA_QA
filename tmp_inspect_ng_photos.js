const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', port:5432, user:'postgres', password:'12345678', database:'e_checksheet_qa' });
(async () => {
  const res = await pool.query(`SELECT id, ng_photos FROM checklist_results WHERE ng_photos IS NOT NULL ORDER BY id DESC LIMIT 10`);
  for (const row of res.rows) {
    console.log('id', row.id);
    let arr;
    try { arr = JSON.parse(row.ng_photos); } catch (e) { arr = null; }
    console.log('parsedType', Array.isArray(arr) ? 'array' : typeof arr, 'length', Array.isArray(arr) ? arr.length : '-');
    if (Array.isArray(arr)) {
      arr.forEach((v, i) => console.log(' ', i, typeof v, v.slice(0, 120)));
    } else {
      console.log(' raw', row.ng_photos.slice(0, 120));
    }
  }
  await pool.end();
})();
