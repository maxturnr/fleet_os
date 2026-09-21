#!/usr/bin/env python3
"""
Script to add dropdown editing and document upload features to FleetOS_v3.html
"""

# Read the v2 file
with open('files/FleetOS_v2.html', 'r') as f:
    content = f.read()

# 1. Add CSS for expandable rows and document upload (after line 233 - after .link-btn styles)
css_insert = '''
/* EXPANDABLE TRANSACTION ROW */
.tx-row-main{cursor:pointer;transition:background 0.15s;}
.tx-row-main:hover{background:var(--surface2)!important;}
.tx-row-main.expanded{background:var(--surface2)!important;border-bottom:none!important;}
.tx-expand-icon{display:inline-block;transition:transform 0.2s;font-size:10px;margin-right:6px;color:var(--muted2);}
.tx-row-main.expanded .tx-expand-icon{transform:rotate(90deg);}
.tx-details{display:none;background:var(--surface3);border-left:3px solid var(--gold);}
.tx-details.open{display:table-row;}
.tx-details-content{padding:16px 20px;}
.tx-detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;}
.tx-detail-item{display:flex;flex-direction:column;gap:4px;}
.tx-detail-label{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--muted2);}
.tx-detail-value{font-size:13px;color:var(--white);}
.tx-detail-input{background:var(--surface2);border:1px solid var(--border2);color:var(--white);padding:6px 10px;font-family:'Instrument Sans',sans-serif;font-size:13px;border-radius:var(--radius);outline:none;width:100%;}
.tx-detail-input:focus{border-color:var(--gold);}
.tx-detail-actions{display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border2);}

/* DOCUMENT UPLOAD */
.tx-documents{margin-top:16px;padding-top:16px;border-top:1px solid var(--border2);}
.tx-documents-title{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:var(--blue);margin-bottom:10px;}
.tx-doc-list{display:flex;flex-direction:column;gap:6px;margin-bottom:10px;}
.tx-doc-item{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);}
.tx-doc-icon{font-size:16px;}
.tx-doc-info{flex:1;display:flex;flex-direction:column;gap:2px;}
.tx-doc-name{font-size:12px;color:var(--white);}
.tx-doc-meta{font-size:10px;color:var(--muted2);font-family:'DM Mono',monospace;}
.tx-doc-actions{display:flex;gap:6px;}
.tx-doc-btn{background:var(--blue);color:#fff;border:none;padding:4px 10px;font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;border-radius:var(--radius);transition:background 0.15s;}
.tx-doc-btn:hover{background:#5dade2;}
.tx-doc-btn.delete{background:var(--red);}
.tx-doc-btn.delete:hover{background:#e74c3c;}
.tx-upload-btn{background:var(--blue);color:#fff;border:none;padding:8px 14px;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;border-radius:var(--radius);transition:background 0.15s;display:inline-flex;align-items:center;gap:6px;}
.tx-upload-btn:hover{background:#5dade2;}
.tx-doc-empty{font-size:11px;color:var(--muted2);font-family:'DM Mono',monospace;padding:12px;text-align:center;background:var(--surface3);border-radius:var(--radius);}

'''

# Insert CSS after .link-btn:hover
content = content.replace('.link-btn:hover{color:var(--white);}', '.link-btn:hover{color:var(--white);}' + css_insert)

# 2. Add transactionDocuments array to state variables
content = content.replace(
    'let transactionSplits = []',
    'let transactionSplits = []\nlet transactionDocuments = []'
)

# 3. Update loadAll to fetch documents
content = content.replace(
    "sb.from('settings').select('*').eq('account_id', accountId)",
    "sb.from('settings').select('*').eq('account_id', accountId),\n    sb.from('transaction_documents').select('*').order('uploaded_at',{ascending:false})"
)

content = content.replace(
    "if(settingsRes.data){",
    "transactionDocuments = docsRes.data || []\n  if(settingsRes.data){"
)

# 4. Replace renderTransactions function with new version
old_render = '''function renderTransactions(){
  const unassignedQB=transactions.filter(t=>!t.assigned&&t.source==='quickbooks')
  const alertEl=document.getElementById('unassigned-alert')
  if(unassignedQB.length>0){
    alertEl.innerHTML=`<div class="unassigned-bar">
      <span class="unassigned-bar-text">⚠ ${unassignedQB.length} QuickBooks transaction${unassignedQB.length>1?'s':''} need assigning</span>
      <button class="unassigned-bar-btn" onclick="document.getElementById('tx-assign-filter').value='unassigned';renderTransactions()">View Unassigned</button>
    </div>`
  } else { alertEl.innerHTML='' }

  const typeF=document.getElementById('tx-type-filter').value
  const assignF=document.getElementById('tx-assign-filter').value
  const statusF=document.getElementById('tx-status-filter').value
  const dateFrom=document.getElementById('tx-date-from').value
  const dateTo=document.getElementById('tx-date-to').value

  let filtered=transactions.filter(t=>{
    if(typeF&&t.type!==typeF) return false
    if(assignF==='unassigned'&&(t.assigned||t.source!=='quickbooks')) return false
    if(assignF==='assigned'&&!t.stock_id) return false
    if(assignF==='overhead'&&t.stock_id) return false
    if(statusF&&t.status!==statusF) return false
    if(dateFrom&&t.date<dateFrom) return false
    if(dateTo&&t.date>dateTo) return false
    return true
  })

  const allStock=[...ownedCars,...sorCars]
  const tbody=document.getElementById('tx-tbody')
  if(!filtered.length){tbody.innerHTML=`<tr><td colspan="11"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No transactions match</div></div></td></tr>`;return}
  
  tbody.innerHTML=filtered.map(t=>{
    const linked=allStock.find(c=>c.id===t.stock_id)
    const isUnassignedQB=!t.assigned&&t.source==='quickbooks'
    const splits=transactionSplits.filter(s=>s.transaction_id===t.id)
    const hasSplits=splits.length>0
    
    let mainRow=`<tr style="${isUnassignedQB?'background:rgba(231,76,60,0.04)':''}${hasSplits?'border-left:3px solid var(--blue)':''}cursor:pointer" onclick="openEditTx(${t.id})" title="Click to edit">
      <td class="muted-text">${fmtDate(t.date)}</td>
      <td>${t.supplier||''}</td>
      <td><span class="badge badge-muted">${t.type}</span></td>
      <td>
        ${hasSplits?`<span class="badge badge-blue">SPLIT</span>`
        :linked?`<span class="reg-badge ${linked.type==='sor'?'sor':''}">${linked.stock_number}</span> <span class="muted-text" style="font-size:11px">${linked.reg}</span>`
        :t.stock_id?'<span class="muted-text">Unknown</span>'
        :'<span class="muted-text" style="font-size:11px">overhead</span>'}
        ${isUnassignedQB?`<button class="link-btn" onclick="event.stopPropagation();openAssignModal(${t.id})">Assign →</button>`:''}
        ${!hasSplits&&!isUnassignedQB?`<button class="split-btn" onclick="event.stopPropagation();openSplitModal(${t.id})">Split</button>`:''}
      </td>
      <td class="num">${fmt(t.amount)}</td>
      <td class="muted-text" style="text-align:center;font-family:'DM Mono',monospace;font-size:11px">${t.vat}</td>
      <td style="text-align:center">${t.thirty_day==='Yes'?'<span class="badge badge-gold">30-day</span>':'<span class="muted-text">—</span>'}</td>
      <td class="muted-text" style="font-size:11px">${t.due_date?fmtDate(t.due_date):'—'}</td>
      <td>${payBadge(t.status)}</td>
      <td><span class="badge ${t.source==='quickbooks'?'badge-blue':'badge-muted'}">${t.source==='quickbooks'?'QB':'Manual'}</span></td>
      <td onclick="event.stopPropagation()"><button class="action-btn" onclick="deleteTx(${t.id})">×</button></td>
    </tr>`
    
    if(hasSplits){
      const splitRows=splits.map(s=>{
        const car=allStock.find(c=>c.id===s.car_id)
        return `<tr class="split-row">
          <td colspan="4" style="padding-left:40px">
            <span class="split-row-car">${car?car.stock_number+' · '+car.reg:'Unknown car'}</span>
            <span class="split-row-amount">${fmt(s.amount)}</span>
          </td>
          <td colspan="7"></td>
        </tr>`
      }).join('')
      return mainRow+splitRows
    }
    
    return mainRow
  }).join('')
}'''

new_render = '''function renderTransactions(){
  const unassignedQB=transactions.filter(t=>!t.assigned&&t.source==='quickbooks')
  const alertEl=document.getElementById('unassigned-alert')
  if(unassignedQB.length>0){
    alertEl.innerHTML=`<div class="unassigned-bar">
      <span class="unassigned-bar-text">⚠ ${unassignedQB.length} QuickBooks transaction${unassignedQB.length>1?'s':''} need assigning</span>
      <button class="unassigned-bar-btn" onclick="document.getElementById('tx-assign-filter').value='unassigned';renderTransactions()">View Unassigned</button>
    </div>`
  } else { alertEl.innerHTML='' }

  const typeF=document.getElementById('tx-type-filter').value
  const assignF=document.getElementById('tx-assign-filter').value
  const statusF=document.getElementById('tx-status-filter').value
  const dateFrom=document.getElementById('tx-date-from').value
  const dateTo=document.getElementById('tx-date-to').value

  let filtered=transactions.filter(t=>{
    if(typeF&&t.type!==typeF) return false
    if(assignF==='unassigned'&&(t.assigned||t.source!=='quickbooks')) return false
    if(assignF==='assigned'&&!t.stock_id) return false
    if(assignF==='overhead'&&t.stock_id) return false
    if(statusF&&t.status!==statusF) return false
    if(dateFrom&&t.date<dateFrom) return false
    if(dateTo&&t.date>dateTo) return false
    return true
  })

  const allStock=[...ownedCars,...sorCars]
  const tbody=document.getElementById('tx-tbody')
  if(!filtered.length){tbody.innerHTML=`<tr><td colspan="11"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No transactions match</div></div></td></tr>`;return}
  
  tbody.innerHTML=filtered.map(t=>{
    const linked=allStock.find(c=>c.id===t.stock_id)
    const isUnassignedQB=!t.assigned&&t.source==='quickbooks'
    const splits=transactionSplits.filter(s=>s.transaction_id===t.id)
    const hasSplits=splits.length>0
    const docs=transactionDocuments.filter(d=>d.transaction_id===t.id)
    
    let mainRow=`<tr class="tx-row-main" id="tx-main-${t.id}" style="${isUnassignedQB?'background:rgba(231,76,60,0.04)':''}${hasSplits?'border-left:3px solid var(--blue)':''}" onclick="toggleTxDetails(${t.id})">
      <td class="muted-text"><span class="tx-expand-icon">▶</span>${fmtDate(t.date)}</td>
      <td>${t.supplier||''}</td>
      <td><span class="badge badge-muted">${t.type}</span></td>
      <td>
        ${hasSplits?`<span class="badge badge-blue">SPLIT</span>`
        :linked?`<span class="reg-badge ${linked.type==='sor'?'sor':''}">${linked.stock_number}</span> <span class="muted-text" style="font-size:11px">${linked.reg}</span>`
        :t.stock_id?'<span class="muted-text">Unknown</span>'
        :'<span class="muted-text" style="font-size:11px">overhead</span>'}
      </td>
      <td class="num">${fmt(t.amount)}</td>
      <td class="muted-text" style="text-align:center;font-family:'DM Mono',monospace;font-size:11px">${t.vat}</td>
      <td style="text-align:center">${t.thirty_day==='Yes'?'<span class="badge badge-gold">30-day</span>':'<span class="muted-text">—</span>'}</td>
      <td class="muted-text" style="font-size:11px">${t.due_date?fmtDate(t.due_date):'—'}</td>
      <td>${payBadge(t.status)}</td>
      <td><span class="badge ${t.source==='quickbooks'?'badge-blue':'badge-muted'}">${t.source==='quickbooks'?'QB':'Manual'}</span></td>
      <td onclick="event.stopPropagation()"><button class="action-btn" onclick="deleteTx(${t.id})">×</button></td>
    </tr>`
    
    let detailsRow=`<tr class="tx-details" id="tx-details-${t.id}">
      <td colspan="11">
        <div class="tx-details-content">
          <div class="tx-detail-grid">
            <div class="tx-detail-item">
              <label class="tx-detail-label">Date</label>
              <input type="date" class="tx-detail-input" id="tx-edit-date-${t.id}" value="${t.date||''}">
            </div>
            <div class="tx-detail-item">
              <label class="tx-detail-label">Supplier</label>
              <input type="text" class="tx-detail-input" id="tx-edit-supplier-${t.id}" value="${(t.supplier||'').replace(/"/g,'&quot;')}">
            </div>
            <div class="tx-detail-item">
              <label class="tx-detail-label">Type</label>
              <select class="tx-detail-input" id="tx-edit-type-${t.id}">
                <option ${t.type==='Vehicle Purchase'?'selected':''}>Vehicle Purchase</option>
                <option ${t.type==='Fuel'?'selected':''}>Fuel</option>
                <option ${t.type==='Parts'?'selected':''}>Parts</option>
                <option ${t.type==='Mechanics'?'selected':''}>Mechanics</option>
                <option ${t.type==='Tyres'?'selected':''}>Tyres</option>
                <option ${t.type==='MOT'?'selected':''}>MOT</option>
                <option ${t.type==='Warranty'?'selected':''}>Warranty</option>
                <option ${t.type==='Advertising'?'selected':''}>Advertising</option>
                <option ${t.type==='Cleaning'?'selected':''}>Cleaning</option>
                <option ${t.type==='HPI'?'selected':''}>HPI</option>
                <option ${t.type==='Travel'?'selected':''}>Travel</option>
                <option ${t.type==='Overhead-Other'?'selected':''}>Overhead-Other</option>
              </select>
            </div>
            <div class="tx-detail-item">
              <label class="tx-detail-label">Amount (£)</label>
              <input type="number" class="tx-detail-input" id="tx-edit-amount-${t.id}" value="${t.amount||''}" step="0.01">
            </div>
            <div class="tx-detail-item">
              <label class="tx-detail-label">VAT</label>
              <select class="tx-detail-input" id="tx-edit-vat-${t.id}">
                <option value="0%" ${t.vat==='0%'?'selected':''}>0% (No VAT)</option>
                <option value="20%" ${t.vat==='20%'?'selected':''}>20% (Standard)</option>
                <option value="5%" ${t.vat==='5%'?'selected':''}>5% (Reduced)</option>
              </select>
            </div>
            <div class="tx-detail-item">
              <label class="tx-detail-label">Payment Status</label>
              <select class="tx-detail-input" id="tx-edit-status-${t.id}">
                <option ${t.status==='Paid'?'selected':''}>Paid</option>
                <option ${t.status==='Unpaid'?'selected':''}>Unpaid</option>
                <option ${t.status==='Overdue'?'selected':''}>Overdue</option>
              </select>
            </div>
            <div class="tx-detail-item">
              <label class="tx-detail-label">30-Day Terms?</label>
              <select class="tx-detail-input" id="tx-edit-thirty-${t.id}">
                <option ${t.thirty_day==='No'?'selected':''}>No</option>
                <option ${t.thirty_day==='Yes'?'selected':''}>Yes</option>
              </select>
            </div>
            <div class="tx-detail-item">
              <label class="tx-detail-label">Due Date</label>
              <input type="date" class="tx-detail-input" id="tx-edit-due-${t.id}" value="${t.due_date||''}">
            </div>
            <div class="tx-detail-item">
              <label class="tx-detail-label">Notes</label>
              <input type="text" class="tx-detail-input" id="tx-edit-notes-${t.id}" value="${(t.notes||'').replace(/"/g,'&quot;')}">
            </div>
          </div>
          <div class="tx-detail-actions">
            <button class="btn-primary" onclick="event.stopPropagation();saveQuickEditTx(${t.id})">Save Changes</button>
            ${isUnassignedQB?`<button class="link-btn" onclick="event.stopPropagation();openAssignModal(${t.id})">Assign to Car →</button>`:''}
            ${!hasSplits?`<button class="split-btn" onclick="event.stopPropagation();openSplitModal(${t.id})">Split Cost</button>`:''}
            <button class="btn-ghost" onclick="event.stopPropagation();toggleTxDetails(${t.id})">Close</button>
          </div>
          <div class="tx-documents">
            <div class="tx-documents-title">📎 Receipts & Invoices</div>
            <div class="tx-doc-list" id="tx-docs-${t.id}"></div>
            <input type="file" id="tx-upload-${t.id}" accept="image/*,.pdf" style="display:none" onchange="handleDocumentUpload(${t.id}, this)">
            <button class="tx-upload-btn" onclick="event.stopPropagation();document.getElementById('tx-upload-${t.id}').click()">📷 Upload / Take Photo</button>
          </div>
        </div>
      </td>
    </tr>`
    
    if(hasSplits){
      const splitRows=splits.map(s=>{
        const car=allStock.find(c=>c.id===s.car_id)
        return `<tr class="split-row">
          <td colspan="4" style="padding-left:40px">
            <span class="split-row-car">${car?car.stock_number+' · '+car.reg:'Unknown car'}</span>
            <span class="split-row-amount">${fmt(s.amount)}</span>
          </td>
          <td colspan="7"></td>
        </tr>`
      }).join('')
      return mainRow+detailsRow+splitRows
    }
    
    return mainRow+detailsRow
  }).join('')
  
  // Render documents for each transaction
  filtered.forEach(t=>{
    renderTxDocuments(t.id)
  })
}'''

content = content.replace(old_render, new_render)

# 5. Add new JavaScript functions after clearTxFilters
js_functions = '''

// Toggle transaction details dropdown
function toggleTxDetails(txId){
  const mainRow = document.getElementById(`tx-main-${txId}`)
  const detailsRow = document.getElementById(`tx-details-${txId}`)
  
  if(!mainRow || !detailsRow) return
  
  const isOpen = detailsRow.classList.contains('open')
  
  // Close all other open details first
  document.querySelectorAll('.tx-details.open').forEach(el => {
    el.classList.remove('open')
  })
  document.querySelectorAll('.tx-row-main.expanded').forEach(el => {
    el.classList.remove('expanded')
  })
  
  // Toggle current row
  if(!isOpen){
    mainRow.classList.add('expanded')
    detailsRow.classList.add('open')
  }
}

// Save quick edit from dropdown
async function saveQuickEditTx(txId){
  const tx = transactions.find(t=>t.id===txId)
  if(!tx) return
  
  const updates = {
    date: document.getElementById(`tx-edit-date-${txId}`).value,
    supplier: document.getElementById(`tx-edit-supplier-${txId}`).value,
    type: document.getElementById(`tx-edit-type-${txId}`).value,
    amount: document.getElementById(`tx-edit-amount-${txId}`).value,
    vat: document.getElementById(`tx-edit-vat-${txId}`).value,
    status: document.getElementById(`tx-edit-status-${txId}`).value,
    thirty_day: document.getElementById(`tx-edit-thirty-${txId}`).value,
    due_date: document.getElementById(`tx-edit-due-${txId}`).value || null,
    notes: document.getElementById(`tx-edit-notes-${txId}`).value
  }
  
  loading(true, 'Saving...')
  
  const {error} = await sb.from('transactions').update(updates).eq('id', txId)
  
  if(error){
    console.error('Error updating transaction:', error)
    toast('Failed to save changes', true)
    loading(false)
    return
  }
  
  await loadAll()
  toast('Transaction updated')
  loading(false)
  
  // Close the dropdown
  toggleTxDetails(txId)
}

// Render documents for a transaction
function renderTxDocuments(txId){
  const docs = transactionDocuments.filter(d=>d.transaction_id===txId)
  const container = document.getElementById(`tx-docs-${txId}`)
  if(!container) return
  
  if(docs.length===0){
    container.innerHTML = '<div class="tx-doc-empty">No documents uploaded yet</div>'
    return
  }
  
  container.innerHTML = docs.map(d=>{
    const icon = d.file_type?.includes('pdf') ? '📄' : '📷'
    const size = d.file_size ? `${Math.round(d.file_size/1024)}KB` : ''
    const date = d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : ''
    
    return `<div class="tx-doc-item">
      <div class="tx-doc-icon">${icon}</div>
      <div class="tx-doc-info">
        <div class="tx-doc-name">${d.file_name}</div>
        <div class="tx-doc-meta">${size} · ${date}</div>
      </div>
      <div class="tx-doc-actions">
        <button class="tx-doc-btn" onclick="event.stopPropagation();viewDocument('${d.file_path}')">View</button>
        <button class="tx-doc-btn delete" onclick="event.stopPropagation();deleteDocument(${d.id},${txId})">×</button>
      </div>
    </div>`
  }).join('')
}

// Handle document upload
async function handleDocumentUpload(txId, input){
  const file = input.files[0]
  if(!file) return
  
  loading(true, 'Uploading...')
  
  try {
    // Upload to Supabase Storage
    const timestamp = Date.now()
    const ext = file.name.split('.').pop()
    const filePath = `${accountId}/tx-${txId}-${timestamp}.${ext}`
    
    const {error: uploadError} = await sb.storage
      .from('transaction-documents')
      .upload(filePath, file)
    
    if(uploadError) throw uploadError
    
    // Save to database
    const {error: dbError} = await sb.from('transaction_documents').insert({
      transaction_id: txId,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type,
      file_size: file.size
    })
    
    if(dbError) throw dbError
    
    // Reload and refresh
    await loadAll()
    renderTxDocuments(txId)
    toast('Document uploaded')
    
  } catch(err){
    console.error('Upload error:', err)
    toast('Upload failed: ' + err.message, true)
  }
  
  loading(false)
  input.value = '' // Reset input
}

// View document
function viewDocument(filePath){
  const {data} = sb.storage.from('transaction-documents').getPublicUrl(filePath)
  if(data?.publicUrl){
    window.open(data.publicUrl, '_blank')
  }
}

// Delete document
async function deleteDocument(docId, txId){
  if(!confirm('Delete this document?')) return
  
  loading(true, 'Deleting...')
  
  try {
    // Get file path first
    const doc = transactionDocuments.find(d=>d.id===docId)
    if(!doc) throw new Error('Document not found')
    
    // Delete from storage
    await sb.storage.from('transaction-documents').remove([doc.file_path])
    
    // Delete from database
    const {error} = await sb.from('transaction_documents').delete().eq('id', docId)
    if(error) throw error
    
    await loadAll()
    renderTxDocuments(txId)
    toast('Document deleted')
    
  } catch(err){
    console.error('Delete error:', err)
    toast('Delete failed: ' + err.message, true)
  }
  
  loading(false)
}
'''

content = content.replace('function clearTxFilters(){', js_functions + '\nfunction clearTxFilters(){')

# Write the updated content to FleetOS_v3.html
with open('files/FleetOS_v3.html', 'w') as f:
    f.write(content)

print("✅ FleetOS_v3.html updated successfully!")
print("✅ Added dropdown editing feature")
print("✅ Added document upload feature")
print("✅ Ready to deploy!")
