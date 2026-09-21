#!/usr/bin/env python3
"""
Update renderOwned and renderSOR to use dropdown editing like transactions
"""

with open('files/FleetOS_v3.html', 'r') as f:
    content = f.read()

# Find and replace renderOwned function
old_render_owned = '''function renderOwned(){
  const statusF=document.getElementById('owned-status-filter').value
  const makeF=document.getElementById('owned-make-filter').value
  const dateFrom=document.getElementById('owned-date-from').value
  const dateTo=document.getElementById('owned-date-to').value
  let filtered=ownedCars.filter(c=>{
    if(statusF&&c.status!==statusF) return false
    if(makeF&&c.make!==makeF) return false
    if(dateFrom&&c.sale_date&&c.sale_date<dateFrom) return false
    if(dateTo&&c.sale_date&&c.sale_date>dateTo) return false
    return true
  }).sort((a,b)=>{
    const numA = parseInt((a.stock_number||'').match(/\\d+$/)?.[0]||'0')
    const numB = parseInt((b.stock_number||'').match(/\\d+$/)?.[0]||'0')
    return numA - numB
  })
  const tbody=document.getElementById('owned-tbody')
  if(!filtered.length){tbody.innerHTML=`<tr><td colspan="13"><div class="empty-state"><div class="empty-icon">🚗</div><div class="empty-text">No cars match filters</div></div></td></tr>`;return}
  tbody.innerHTML=filtered.map(c=>{
    const p=ownedProfit(c); const costs=getDirectCosts(c.id)
    return `<tr>
      <td><span class="stock-num">${c.stock_number||'—'}</span></td>
      <td><span class="reg-badge">${c.reg}</span></td>
      <td><span style="font-weight:500">${c.make||''}</span> <span class="muted-text">${c.model||''}</span></td>
      <td class="num">${c.paid?fmt(c.paid):'<span class="muted-text">—</span>'}</td>
      <td class="num">${c.sold?fmt(c.sold):'<span class="muted-text">—</span>'}</td>
      <td class="num muted-text">${fmt(costs)}</td>
      <td class="num muted-text">${vatRegistered&&p&&p.vat?fmt(p.vat):'<span class="muted-text">—</span>'}</td>
      <td class="num" style="color:${p?pc(p.gross):''}">${p?fmt(p.gross):'<span class="muted-text">—</span>'}</td>
      <td class="num" style="color:var(--red)">${p&&p.tax>0?fmt(p.tax):'<span class="muted-text">—</span>'}</td>
      <td class="num" style="color:${p?pc(p.net):''};font-weight:600">${p?fmt(p.net):'<span class="muted-text">—</span>'}</td>
      <td>${statusBadge(c.status)}</td>
      <td class="num muted-text" style="font-size:11px">${daysInStock(c)}d</td>
      <td><button class="action-btn" onclick="deleteCar(${c.id})">×</button></td>
    </tr>`
  }).join('')
}'''

new_render_owned = '''function renderOwned(){
  const statusF=document.getElementById('owned-status-filter').value
  const makeF=document.getElementById('owned-make-filter').value
  const dateFrom=document.getElementById('owned-date-from').value
  const dateTo=document.getElementById('owned-date-to').value
  let filtered=ownedCars.filter(c=>{
    if(statusF&&c.status!==statusF) return false
    if(makeF&&c.make!==makeF) return false
    if(dateFrom&&c.sale_date&&c.sale_date<dateFrom) return false
    if(dateTo&&c.sale_date&&c.sale_date>dateTo) return false
    return true
  }).sort((a,b)=>{
    const numA = parseInt((a.stock_number||'').match(/\\d+$/)?.[0]||'0')
    const numB = parseInt((b.stock_number||'').match(/\\d+$/)?.[0]||'0')
    return numA - numB
  })
  const tbody=document.getElementById('owned-tbody')
  if(!filtered.length){tbody.innerHTML=`<tr><td colspan="13"><div class="empty-state"><div class="empty-icon">🚗</div><div class="empty-text">No cars match filters</div></div></td></tr>`;return}
  tbody.innerHTML=filtered.map(c=>{
    const p=ownedProfit(c); const costs=getDirectCosts(c.id)
    
    let mainRow = `<tr class="stock-row-main" id="stock-main-owned-${c.id}" onclick="toggleStockDetails(${c.id}, 'owned')">
      <td><span class="stock-expand-icon">▶</span><span class="stock-num">${c.stock_number||'—'}</span></td>
      <td><span class="reg-badge">${c.reg}</span></td>
      <td><span style="font-weight:500">${c.make||''}</span> <span class="muted-text">${c.model||''}</span></td>
      <td class="num">${c.paid?fmt(c.paid):'<span class="muted-text">—</span>'}</td>
      <td class="num">${c.sold?fmt(c.sold):'<span class="muted-text">—</span>'}</td>
      <td class="num muted-text">${fmt(costs)}</td>
      <td class="num muted-text">${vatRegistered&&p&&p.vat?fmt(p.vat):'<span class="muted-text">—</span>'}</td>
      <td class="num" style="color:${p?pc(p.gross):''}">${p?fmt(p.gross):'<span class="muted-text">—</span>'}</td>
      <td class="num" style="color:var(--red)">${p&&p.tax>0?fmt(p.tax):'<span class="muted-text">—</span>'}</td>
      <td class="num" style="color:${p?pc(p.net):''};font-weight:600">${p?fmt(p.net):'<span class="muted-text">—</span>'}</td>
      <td>${statusBadge(c.status)}</td>
      <td class="num muted-text" style="font-size:11px">${daysInStock(c)}d</td>
      <td onclick="event.stopPropagation()"><button class="action-btn" onclick="deleteCar(${c.id})">×</button></td>
    </tr>`
    
    let detailsRow = `<tr class="stock-details" id="stock-details-owned-${c.id}">
      <td colspan="13">
        <div class="stock-details-content">
          <div class="stock-detail-grid">
            <div class="stock-detail-item">
              <label class="stock-detail-label">Registration</label>
              <input type="text" class="stock-detail-input" id="owned-edit-reg-${c.id}" value="${(c.reg||'').replace(/"/g,'&quot;')}">
            </div>
            <div class="stock-detail-item">
              <label class="stock-detail-label">Make</label>
              <input type="text" class="stock-detail-input" id="owned-edit-make-${c.id}" value="${(c.make||'').replace(/"/g,'&quot;')}">
            </div>
            <div class="stock-detail-item">
              <label class="stock-detail-label">Model</label>
              <input type="text" class="stock-detail-input" id="owned-edit-model-${c.id}" value="${(c.model||'').replace(/"/g,'&quot;')}">
            </div>
            <div class="stock-detail-item">
              <label class="stock-detail-label">Purchase Date</label>
              <input type="date" class="stock-detail-input" id="owned-edit-purchase-${c.id}" value="${c.purchase_date||''}">
            </div>
            <div class="stock-detail-item">
              <label class="stock-detail-label">Paid (£)</label>
              <input type="number" class="stock-detail-input" id="owned-edit-paid-${c.id}" value="${c.paid||''}" step="0.01">
            </div>
            <div class="stock-detail-item">
              <label class="stock-detail-label">Sold (£)</label>
              <input type="number" class="stock-detail-input" id="owned-edit-sold-${c.id}" value="${c.sold||''}" step="0.01">
            </div>
            <div class="stock-detail-item">
              <label class="stock-detail-label">Sale Date</label>
              <input type="date" class="stock-detail-input" id="owned-edit-sale-date-${c.id}" value="${c.sale_date||''}">
            </div>
            <div class="stock-detail-item">
              <label class="stock-detail-label">Status</label>
              <select class="stock-detail-input" id="owned-edit-status-${c.id}">
                <option ${c.status==='In Stock'?'selected':''}>In Stock</option>
                <option ${c.status==='Part Exchange'?'selected':''}>Part Exchange</option>
                <option ${c.status==='Sold'?'selected':''}>Sold</option>
              </select>
            </div>
          </div>
          <div class="stock-detail-actions">
            <button class="btn-primary" onclick="event.stopPropagation();saveQuickEditOwned(${c.id})">Save Changes</button>
            <button class="btn-ghost" onclick="event.stopPropagation();toggleStockDetails(${c.id}, 'owned')">Close</button>
          </div>
        </div>
      </td>
    </tr>`
    
    return mainRow + detailsRow
  }).join('')
}'''

content = content.replace(old_render_owned, new_render_owned)

# Now update renderSOR - need to read more to get the full function
# Let me find where it ends
import re

# Find renderSOR function
sor_match = re.search(r'function renderSOR\(\){.*?^}', content, re.MULTILINE | re.DOTALL)
if sor_match:
    old_render_sor = sor_match.group(0)
    
    # Create new version with dropdown
    new_render_sor = '''function renderSOR(){
  const statusF=document.getElementById('sor-status-filter').value
  const dateFrom=document.getElementById('sor-date-from').value
  const dateTo=document.getElementById('sor-date-to').value
  let filtered=sorCars.filter(c=>{
    if(statusF&&c.status!==statusF) return false
    if(dateFrom&&c.sale_date&&c.sale_date<dateFrom) return false
    if(dateTo&&c.sale_date&&c.sale_date>dateTo) return false
    return true
  }).sort((a,b)=>{
    const numA = parseInt((a.stock_number||'').match(/\\d+$/)?.[0]||'0')
    const numB = parseInt((b.stock_number||'').match(/\\d+$/)?.[0]||'0')
    return numA - numB
  })
  const tbody=document.getElementById('sor-tbody')
  if(!filtered.length){tbody.innerHTML=`<tr><td colspan="14"><div class="empty-state"><div class="empty-icon">🔄</div><div class="empty-text">No sale or return cars</div></div></td></tr>`;return}
  tbody.innerHTML=filtered.map(c=>{
    const p=sorProfit(c); const costs=getDirectCosts(c.id)
    const netFee=c.fee?sorNetFee(c):null
    const vatLabel=c.fee_vat==='none'?'No VAT':c.fee_vat==='inclusive'?'Incl VAT':'+ VAT'
    
    let mainRow = `<tr class="stock-row-main" id="stock-main-sor-${c.id}" onclick="toggleStockDetails(${c.id}, 'sor')">
      <td><span class="stock-expand-icon">▶</span><span class="stock-num" style="color:var(--purple)">${c.stock_number||'—'}</span></td>
      <td><span class="reg-badge sor">${c.reg}</span></td>
      <td><span style="font-weight:500">${c.make||''}</span> <span class="muted-text">${c.model||''}</span></td>
      <td class="num muted-text">${c.min_price?fmt(c.min_price):'—'}</td>
      <td class="num">${c.sale_price?fmt(c.sale_price):'<span class="muted-text">—</span>'}</td>
      <td class="num">${c.fee?fmt(c.fee):'<span class="muted-text">—</span>'}</td>
      <td class="muted-text" style="font-size:10px;text-align:center">${c.fee?vatLabel:'—'}</td>
      <td class="num" style="color:var(--purple)">${netFee?fmt(netFee):'<span class="muted-text">—</span>'}</td>
      <td class="num muted-text">${fmt(costs)}</td>
      <td class="num" style="color:${p?pc(p.net):''};font-weight:600">${p?fmt(p.net):'<span class="muted-text">—</span>'}</td>
      <td class="num" style="color:var(--red)">${p&&p.tax>0?fmt(p.tax):'<span class="muted-text">—</span>'}</td>
      <td>${statusBadge(c.status)}</td>
      <td class="num muted-text" style="font-size:11px">${daysInStock(c)}d</td>
      <td onclick="event.stopPropagation()"><button class="action-btn" onclick="deleteCar(${c.id})">×</button></td>
    </tr>`
    
    let detailsRow = `<tr class="stock-details sor-details" id="stock-details-sor-${c.id}">
      <td colspan="14">
        <div class="stock-details-content">
          <div class="stock-detail-grid">
            <div class="stock-detail-item">
              <label class="stock-detail-label">Registration</label>
              <input type="text" class="stock-detail-input purple-focus" id="sor-edit-reg-${c.id}" value="${(c.reg||'').replace(/"/g,'&quot;')}">
            </div>
            <div class="stock-detail-item">
              <label class="stock-detail-label">Make</label>
              <input type="text" class="stock-detail-input purple-focus" id="sor-edit-make-${c.id}" value="${(c.make||'').replace(/"/g,'&quot;')}">
            </div>
            <div class="stock-detail-item">
              <label class="stock-detail-label">Model</label>
              <input type="text" class="stock-detail-input purple-focus" id="sor-edit-model-${c.id}" value="${(c.model||'').replace(/"/g,'&quot;')}">
            </div>
            <div class="stock-detail-item">
              <label class="stock-detail-label">Owner Name</label>
              <input type="text" class="stock-detail-input purple-focus" id="sor-edit-owner-${c.id}" value="${(c.owner_name||'').replace(/"/g,'&quot;')}">
            </div>
            <div class="stock-detail-item">
              <label class="stock-detail-label">Received Date</label>
              <input type="date" class="stock-detail-input purple-focus" id="sor-edit-received-${c.id}" value="${c.received_date||''}">
            </div>
            <div class="stock-detail-item">
              <label class="stock-detail-label">Min Price (£)</label>
              <input type="number" class="stock-detail-input purple-focus" id="sor-edit-min-${c.id}" value="${c.min_price||''}" step="0.01">
            </div>
            <div class="stock-detail-item">
              <label class="stock-detail-label">Sale Price (£)</label>
              <input type="number" class="stock-detail-input purple-focus" id="sor-edit-sale-price-${c.id}" value="${c.sale_price||''}" step="0.01">
            </div>
            <div class="stock-detail-item">
              <label class="stock-detail-label">Sale Date</label>
              <input type="date" class="stock-detail-input purple-focus" id="sor-edit-sale-date-${c.id}" value="${c.sale_date||''}">
            </div>
            <div class="stock-detail-item">
              <label class="stock-detail-label">Fee (£)</label>
              <input type="number" class="stock-detail-input purple-focus" id="sor-edit-fee-${c.id}" value="${c.fee||''}" step="0.01">
            </div>
            <div class="stock-detail-item">
              <label class="stock-detail-label">Fee VAT</label>
              <select class="stock-detail-input purple-focus" id="sor-edit-fee-vat-${c.id}">
                <option value="none" ${c.fee_vat==='none'?'selected':''}>No VAT</option>
                <option value="inclusive" ${c.fee_vat==='inclusive'?'selected':''}>Inclusive</option>
                <option value="additional" ${c.fee_vat==='additional'?'selected':''}>+ VAT</option>
              </select>
            </div>
            <div class="stock-detail-item">
              <label class="stock-detail-label">Status</label>
              <select class="stock-detail-input purple-focus" id="sor-edit-status-${c.id}">
                <option ${c.status==='On Site'?'selected':''}>On Site</option>
                <option ${c.status==='Sold'?'selected':''}>Sold</option>
                <option ${c.status==='Returned'?'selected':''}>Returned</option>
              </select>
            </div>
          </div>
          <div class="stock-detail-actions">
            <button class="btn-primary purple" onclick="event.stopPropagation();saveQuickEditSOR(${c.id})">Save Changes</button>
            <button class="btn-ghost" onclick="event.stopPropagation();toggleStockDetails(${c.id}, 'sor')">Close</button>
          </div>
        </div>
      </td>
    </tr>`
    
    return mainRow + detailsRow
  }).join('')
}'''
    
    content = content.replace(old_render_sor, new_render_sor)

with open('files/FleetOS_v3.html', 'w') as f:
    f.write(content)

print("✅ Stock rendering updated!")
print("✅ Owned stock now has dropdown editing")
print("✅ SOR stock now has dropdown editing")
