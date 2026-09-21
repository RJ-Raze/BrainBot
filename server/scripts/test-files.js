const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const base = process.env.SMOKE_BASE || 'http://web';
if (process.env.BRAINBOT_TEST !== '1') throw new Error('Requires isolated BRAINBOT_TEST=1');
async function request(method, route, token, body, status = 200) {
  const r = await fetch(base + '/api/v1' + route, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(40000) });
  const j = await r.json(); assert.equal(r.status, status, JSON.stringify(j)); return j.data;
}
function pdf() {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>', '', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  for (const [index, text] of [[3, 'First page evidence'], [5, 'Second page evidence']]) { const stream = `BT /F1 12 Tf 20 200 Td (${text}) Tj ET`; objects[index] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`; }
  let result = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((o,i) => { offsets.push(Buffer.byteLength(result)); result += `${i+1} 0 obj\n${o}\nendobj\n`; });
  const start = Buffer.byteLength(result); result += `xref\n0 8\n0000000000 65535 f \n` + offsets.slice(1).map(x => String(x).padStart(10,'0')+' 00000 n \n').join('') + `trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return result;
}
(async () => {
  const user = await request('POST','/auth/register',null,{username:'files_'+crypto.randomBytes(5).toString('hex'),password:'Files@123456'});
  const outsider = await request('POST','/auth/register',null,{username:'outside_'+crypto.randomBytes(5).toString('hex'),password:'Files@123456'});
  const project = await request('POST','/projects',user.token,{name:'原文引用验收'});
  const root = `/projects/${project.id}/files`;
  const role = await request('POST',`/projects/${project.id}/roles`,user.token,{name:'引用核验员',system_prompt:'核对原文'});
  const zip = new (require('jszip'))();
  zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
  zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>DOCX evidence</w:t></w:r></w:p></w:body></w:document>');
  for (const [name, content, quote, number] of [['evidence.txt','第一段证据。\n\n第二段证据。','第二段证据。',2],['evidence.pdf',pdf(),'Second page evidence',2],['evidence.docx',await zip.generateAsync({type:'nodebuffer'}),'DOCX evidence',1]]) {
    const form = new FormData(); form.append('file',new Blob([content]),name);
    const response = await fetch(base+'/api/v1'+root,{method:'POST',headers:{Authorization:`Bearer ${user.token}`},body:form});
    const file = (await response.json()).data; assert.equal(response.status,200);
    const document = await request('GET',`${root}/${file.id}/text`,user.token); assert.equal(document.status,'ready');
    assert(document.pages.find(p=>p.number===number).text.includes(quote));
    const citation = await request('POST',`${root}/${file.id}/citations`,user.token,{quote,number}); assert.equal(citation.verified,true);
    await request('POST',`${root}/${file.id}/citations`,user.token,{quote:'invented evidence',number},400);
    await request('GET',`${root}/${file.id}/text`,outsider.token,undefined,403);
    await request('POST',`${root}/${file.id}/citations`,user.token,{quote,number:9999},400);
    const research = `/projects/${project.id}/research`;
    const paper = await request('POST',research+'/papers',user.token,{title:name,external_id:name});
    const card = await request('POST',research+'/paper-cards',user.token,{paper_id:paper.id,role_id:role.id,evidence_quote:quote,evidence_locator:citation.locator});
    const cardPath = research+'/paper-cards/'+card.id;
    const reviewed = await request('POST',cardPath+'/review-evidence',user.token,{status:'reviewed'}); assert.equal(reviewed.evidence_status,'reviewed');
    const changed = await request('PATCH',cardPath,user.token,{evidence_quote:'invented evidence'}); assert.equal(changed.evidence_status,'unverified');
    await request('POST',cardPath+'/review-evidence',user.token,{status:'reviewed'},400);
    await request('PATCH',cardPath,user.token,{evidence_quote:quote});
    await request('DELETE',`${root}/${file.id}`,user.token);
    await request('POST',cardPath+'/review-evidence',user.token,{status:'reviewed'},400);
  }
  console.log('[files] PASS: PDF page 2, DOCX/TXT paragraphs, exact quote, wrong page, invented quote, tenant isolation, edit invalidation, deleted source rejected');
})().catch(e=>{console.error(e);process.exitCode=1});
