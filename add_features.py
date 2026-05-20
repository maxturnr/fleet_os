#!/usr/bin/env python3
"""
Add three features:
1. Persist current tab on refresh
2. Autofill paid amount from Vehicle Purchase transactions
3. Add dropdown editing for stock (owned and SOR)
"""

with open('files/FleetOS_v3.html', 'r') as f:
    content = f.read()

# ============================================
# FEATURE 1: Persist Current Tab
# ============================================

# Update showTab to save current tab to localStorage
old_show_tab = '''function showTab(name,btn){
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'))
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'))
  document.getElementById('tab-'+name).classList.add('active')
  if(btn) btn.classList.add('active')
  currentTab=name; renderCurrentTab()
}'''

new_show_tab = '''function showTab(name,btn){
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'))
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'))
  document.getElementById('tab-'+name).classList.add('active')
  if(btn) btn.classList.add('active')
  currentTab=name
  localStorage.setItem('fleet_current_tab', name)
  renderCurrentTab()
}'''

content = content.replace(old_show_tab, new_show_tab)

# Update initApp to restore saved tab
old_init_app = '''async function initApp(){
  document.getElementById('dash-date').textContent =
    new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
  const now=new Date()
  document.getElementById('pnl-from').value=new Date(now.getFullYear(),now.getMonth(),1).toISOString().split('T')[0]
  document.getElementById('pnl-to').value=today()
  checkQBCallback()
  await loadAll()
}'''

new_init_app = '''async function initApp(){
  document.getElementById('dash-date').textContent =
    new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
  const now=new Date()
  document.getElementById('pnl-from').value=new Date(now.getFullYear(),now.getMonth(),1).toISOString().split('T')[0]
  document.getElementById('pnl-to').value=today()
  checkQBCallback()
  await loadAll()
  
  // Restore last active tab
  const savedTab = localStorage.getItem('fleet_current_tab')
  if(savedTab && savedTab !== 'dashboard'){
    const tabBtn = document.querySelector(`[onclick*="showTab('${savedTab}"]`)
    if(tabBtn) showTab(savedTab, tabBtn)
  }
}'''

content = content.replace(old_init_app, new_init_app)

# ============================================
# FEATURE 2: Autofill Paid Amount
# ============================================

# Update openModal for add-owned to autofill paid amount from transactions
old_add_owned = '''  if(name==='add-owned'){
    ['owned-reg','owned-make','owned-model','owned-sold','owned-sale-date'].forEach(id=>document.getElementById(id).value='')
    document.getElementById('owned-purchase-date').value=today()
    document.getElementById('owned-status').value='In Stock'
    document.getElementById('next-stk-preview').textContent=nextStockNum('owned')
  }'''

new_add_owned = '''  if(name==='add-owned'){
    ['owned-reg','owned-make','owned-model','owned-sold','owned-sale-date'].forEach(id=>document.getElementById(id).value='')
    document.getElementById('owned-purchase-date').value=today()
    document.getElementById('owned-status').value='In Stock'
    document.getElementById('next-stk-preview').textContent=nextStockNum('owned')
    
    // Autofill paid amount from Vehicle Purchase transactions
    const vehiclePurchases = transactions.filter(t => t.type === 'Vehicle Purchase' && !t.stock_id)
    if(vehiclePurchases.length > 0) {
      // Get the most recent unassigned vehicle purchase
      const latestPurchase = vehiclePurchases[0]
      document.getElementById('owned-paid').value = latestPurchase.amount || ''
    } else {
      document.getElementById('owned-paid').value = ''
    }
  }'''

content = content.replace(old_add_owned, new_add_owned)

# ============================================
# FEATURE 3: Add CSS for Stock Dropdown Editing
# ============================================

stock_css = '''
/* EXPANDABLE STOCK ROW */
.stock-row-main{cursor:pointer;transition:background 0.15s;}
.stock-row-main:hover{background:var(--surface2)!important;}
.stock-row-main.expanded{background:var(--surface2)!important;border-bottom:none!important;}
.stock-expand-icon{display:inline-block;transition:transform 0.2s;font-size:10px;margin-right:6px;color:var(--muted2);}
.stock-row-main.expanded .stock-expand-icon{transform:rotate(90deg);}
.stock-details{display:none;background:var(--surface3);border-left:3px solid var(--gold);}
.stock-details.open{display:table-row;}
.stock-details.sor-details{border-left-color:var(--purple);}
.stock-details-content{padding:16px 20px;}
.stock-detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;}
.stock-detail-item{display:flex;flex-direction:column;gap:4px;}
.stock-detail-label{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--muted2);}
.stock-detail-input{background:var(--surface2);border:1px solid var(--border2);color:var(--white);padding:6px 10px;font-family:'Instrument Sans',sans-serif;font-size:13px;border-radius:var(--radius);outline:none;width:100%;}
.stock-detail-input:focus{border-color:var(--gold);}
.stock-detail-input.purple-focus:focus{border-color:var(--purple);}
.stock-detail-actions{display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border2);}

'''

# Insert after the tx-documents CSS
content = content.replace('.tx-doc-empty{font-size:11px;color:var(--muted2);font-family:\'DM Mono\',monospace;padding:12px;text-align:center;background:var(--surface3);border-radius:var(--radius);}', 
                         '.tx-doc-empty{font-size:11px;color:var(--muted2);font-family:\'DM Mono\',monospace;padding:12px;text-align:center;background:var(--surface3);border-radius:var(--radius);}' + stock_css)

# ============================================
# FEATURE 4: Add JavaScript Functions for Stock Dropdown
# ============================================

stock_js = '''
// Toggle stock details dropdown
function toggleStockDetails(stockId, type){
  const mainRow = document.getElementById(`stock-main-${type}-${stockId}`)
  const detailsRow = document.getElementById(`stock-details-${type}-${stockId}`)
  
  if(!mainRow || !detailsRow) return
  
  const isOpen = detailsRow.classList.contains('open')
  
  // Close all other open details first
  document.querySelectorAll('.stock-details.open').forEach(el => {
    el.classList.remove('open')
  })
  document.querySelectorAll('.stock-row-main.expanded').forEach(el => {
    el.classList.remove('expanded')
  })
  
  // Toggle current row
  if(!isOpen){
    mainRow.classList.add('expanded')
    detailsRow.classList.add('open')
  }
}

// Save quick edit for owned stock
async function saveQuickEditOwned(carId){
  const car = ownedCars.find(c=>c.id===carId)
  if(!car) return
  
  const updates = {
    reg: document.getElementById(`owned-edit-reg-${carId}`).value,
    make: document.getElementById(`owned-edit-make-${carId}`).value,
    model: document.getElementById(`owned-edit-model-${carId}`).value,
    purchase_date: document.getElementById(`owned-edit-purchase-${carId}`).value,
    paid: document.getElementById(`owned-edit-paid-${carId}`).value,
    sold: document.getElementById(`owned-edit-sold-${carId}`).value || null,
    sale_date: document.getElementById(`owned-edit-sale-date-${carId}`).value || null,
    status: document.getElementById(`owned-edit-status-${carId}`).value
  }
  
  loading(true, 'Saving...')
  
  const {error} = await sb.from('cars').update(updates).eq('id', carId)
  
  if(error){
    console.error('Error updating car:', error)
    toast('Failed to save changes', true)
    loading(false)
    return
  }
  
  await loadAll()
  toast('Car updated')
  loading(false)
  
  toggleStockDetails(carId, 'owned')
}

// Save quick edit for SOR stock
async function saveQuickEditSOR(carId){
  const car = sorCars.find(c=>c.id===carId)
  if(!car) return
  
  const updates = {
    reg: document.getElementById(`sor-edit-reg-${carId}`).value,
    make: document.getElementById(`sor-edit-make-${carId}`).value,
    model: document.getElementById(`sor-edit-model-${carId}`).value,
    owner_name: document.getElementById(`sor-edit-owner-${carId}`).value,
    received_date: document.getElementById(`sor-edit-received-${carId}`).value,
    min_price: document.getElementById(`sor-edit-min-${carId}`).value,
    sale_price: document.getElementById(`sor-edit-sale-price-${carId}`).value || null,
    sale_date: document.getElementById(`sor-edit-sale-date-${carId}`).value || null,
    fee: document.getElementById(`sor-edit-fee-${carId}`).value || null,
    fee_vat: document.getElementById(`sor-edit-fee-vat-${carId}`).value,
    status: document.getElementById(`sor-edit-status-${carId}`).value
  }
  
  loading(true, 'Saving...')
  
  const {error} = await sb.from('cars').update(updates).eq('id', carId)
  
  if(error){
    console.error('Error updating car:', error)
    toast('Failed to save changes', true)
    loading(false)
    return
  }
  
  await loadAll()
  toast('Car updated')
  loading(false)
  
  toggleStockDetails(carId, 'sor')
}

'''

# Add after the deleteDocument function
content = content.replace('// ══════════════════════════════════════════════\n// P&L\n// ══════════════════════════════════════════════', 
                         stock_js + '\n// ══════════════════════════════════════════════\n// P&L\n// ══════════════════════════════════════════════')

# Save the file
with open('files/FleetOS_v3.html', 'w') as f:
    f.write(content)

print("✅ Features added successfully!")
print("✅ 1. Tab persistence on refresh")
print("✅ 2. Autofill paid amount from Vehicle Purchase transactions")
print("✅ 3. Added CSS and JS for stock dropdown editing")
print("⚠️  Note: Still need to update renderOwnedStock and renderSORStock functions")
