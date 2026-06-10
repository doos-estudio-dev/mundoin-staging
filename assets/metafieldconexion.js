// ======= METAFIELD CONEXIÓN VERCEL + SCRIPTS =======
document.addEventListener('DOMContentLoaded', async () => {
  const wrapper = document.getElementById('sucursales-accordion-wrapper');
  if(!wrapper) return;

  const container = document.getElementById('sucursales-table-container');
  const content = document.getElementById('sucursales-content');
  const icon = document.getElementById('accordion-icon');
  let isOpen = false;

  window.toggleSucursales = function(){
    isOpen = !isOpen;
    content.style.maxHeight = isOpen ? content.scrollHeight + 'px' : '0';
    icon.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0)';
  };

  // ======= FUNCIONES PARA CARGAR SCRIPTS EXTERNOS =======
  function loadScript(src, attrs = {}) {
    return new Promise((resolve, reject) => {
      if(document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.defer = true;
      Object.entries(attrs).forEach(([k,v]) => s.setAttribute(k,v));
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Ejemplo de scripts que fallaban antes
  const scriptsToLoad = [
    'https://mundoin.mx/web-pixel-2123465006@524f6c1ee37bacdca7657a665bdca589.js',
    'https://mundoin.mx/shop_events_listener-3da45d37.js',
    'https://mundoin.mx/swym-ext-shopify.js'
    // agrega más si necesitas
  ];

  try {
    for(const src of scriptsToLoad) await loadScript(src);
    console.log('Todos los scripts externos cargados');
  } catch(e) {
    console.warn('Error cargando scripts externos:', e);
  }

  // ======= FETCH METAFIELD DESDE VERCEL =======
  let data;
  try {
    const res = await fetch('https://mundo-in-git-main-seos-projects-2e8857cd.vercel.app/api/metafields'); 
    data = await res.json();
  } catch(e){
    console.error('Error al traer datos del metafield:', e);
    wrapper.style.display = 'none';
    return;
  }

  if(!data?.sucursales?.length || !data?.variantes?.length){
    wrapper.style.display = 'none';
    return;
  }

  function getSelectedOption(){
    const vp = document.querySelector('variant-picker');
    if(vp){
      const checked = vp.querySelector('input[type="radio"]:checked');
      if(checked) return checked.value.toLowerCase().trim();
    }
    const sel = document.querySelector('select[name^="option"]');
    if(sel?.value) return sel.value.toLowerCase().trim();
    return '';
  }

  function findVariant(optionText){
    if(!optionText) return data.variantes[0];
    return data.variantes.find(v =>
      v.opciones.some(o => {
        const val = o.valor.toLowerCase().trim();
        return val === optionText || optionText.includes(val) || val.includes(optionText);
      })
    ) || data.variantes[0];
  }

  function render(){
    const opt = getSelectedOption();
    const variant = findVariant(opt);
    if(!variant){ wrapper.style.display = 'none'; return; }

    const stock = data.sucursales
      .map((s,i) => ({nombre:s.nombre, mapa:s.mapa, qty:variant.cantidades[i]||0}))
      .filter(s => s.nombre !== 'WEB' && s.qty > 0);

    if(!stock.length){ wrapper.style.display = 'none'; return; }

    wrapper.style.display = 'block';
    container.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#f8f8f8">
        <th style="padding:12px;text-align:left;border-bottom:2px solid #e0e0e0;font-weight:600">Sucursal</th>
        <th style="padding:12px;text-align:center;border-bottom:2px solid #e0e0e0;font-weight:600">Stock</th>
        <th style="padding:12px;text-align:center;border-bottom:2px solid #e0e0e0;font-weight:600">Ubicación</th>
      </tr></thead>
      <tbody>${stock.map(s => `<tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:14px 12px"><strong>${s.nombre}</strong></td>
        <td style="padding:14px 12px;text-align:center"><span style="color:#2e7d32;font-weight:500">${s.qty}</span></td>
        <td style="padding:14px 12px;text-align:center"><a href="${s.mapa}" target="_blank" rel="noopener" style="display:inline-block;padding:6px 14px;background:#7EB4C1;color:#fff;text-decoration:none;border-radius:1px;font-size:14px">Ver mapa</a></td>
      </tr>`).join('')}</tbody>
    </table></div>`;

    if(isOpen) content.style.maxHeight = content.scrollHeight + 'px';
  }

  // ======= LISTENERS =======
  const vp = document.querySelector('variant-picker');
  if(vp){
    vp.addEventListener('change', render);
    vp.addEventListener('click', e => {
      if(e.target.closest('.variant-option__button-label')) setTimeout(render, 20);
    });
  }

  const idInput = document.querySelector('input[name="id"]');
  if(idInput){
    let last = idInput.value;
    (function poll(){
      if(idInput.value !== last){ last = idInput.value; render(); }
      requestAnimationFrame(poll);
    })();
  }

  ['variant:change','variantchange','variantUpdate'].forEach(evt =>
    document.addEventListener(evt, render)
  );

  // Render inicial
  render();
});
