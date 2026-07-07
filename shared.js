// ═══════════════════════════════════════════════════════════════
// shared.js — Contender Club
// Funciones compartidas entre admin.html y entrenador.html.
// Ambos archivos importan este script ANTES de su lógica propia.
// ═══════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────
// CONSTANTES GLOBALES (pueden ser sobreescritas por cada vista)
// ──────────────────────────────────────────────────────────────
var PIN_ADMIN   = "1234";
var PLAN_PRECIO = {};
var PLAN_DIAS   = {};
var PLAN_ABONOS = {};

// Estado de detalle compartido
var socioActual     = null;
var detTab          = "membresia";
var waTarget        = null;
var _cobroPendiente = null;
var socEditId       = null;

// ──────────────────────────────────────────────────────────────
// UTILIDADES
// ──────────────────────────────────────────────────────────────
function ge(id)    { return document.getElementById(id); }
function fm(n)     { return "$" + Number(n).toLocaleString("es-MX"); }
function fF(f)     { return f ? new Date(f+"T00:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short",year:"2-digit"}) : "—"; }
function addDays(f,d) { var dt=new Date(f+"T00:00:00"); dt.setDate(dt.getDate()+d); return dt.toISOString().slice(0,10); }
function addWeeks(f,w) { return addDays(f, w*7); }
function ini(s)    { return (s.nombre[0]+s.apellido_paterno[0]).toUpperCase(); }
function nCompleto(s) { return s.nombre+" "+s.apellido_paterno+" "+(s.apellido_materno||""); }

function calcStatus(s) {
  if (!s.activo) return "inactivo";
  var h=new Date(); h.setHours(0,0,0,0);
  var v=new Date(s.fecha_vencimiento+"T00:00:00");
  var d=Math.ceil((v-h)/86400000);
  if (d<0) return "vencido"; if (d===0) return "vencehoy"; return "aldia";
}
function avColor(st) { return st==="aldia"?"#C8F135":st==="vencehoy"?"var(--orange)":"var(--red)"; }
function pillSt(st) {
  var m={aldia:"pg",vencehoy:"po",vencido:"pr",inactivo:"pm"};
  var l={aldia:"Al día",vencehoy:"Vence hoy",vencido:"Vencido",inactivo:"Inactivo"};
  return "<span class='pill "+(m[st]||"pm")+"'>"+(l[st]||st)+"</span>";
}
function mostrarToast(msg) {
  var t=document.getElementById("toast");
  if (!t) {
    t=document.createElement("div"); t.id="toast";
    t.style.cssText="position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#1A1A1A;color:#C8F135;border:1px solid rgba(200,241,53,.4);border-radius:10px;padding:8px 16px;font-size:12px;font-weight:700;z-index:9999;transition:opacity .3s";
    document.body.appendChild(t);
  }
  t.textContent=msg; t.style.opacity="1"; clearTimeout(t._t);
  t._t=setTimeout(function(){t.style.opacity="0";},2200);
}

// ──────────────────────────────────────────────────────────────
// PLANES — poblar selects desde catálogo
// ──────────────────────────────────────────────────────────────
function poblarSelectPlanes() {
  var mems = (typeof MEMBRESIAS!=="undefined") ? MEMBRESIAS : [];
  var msgs = (typeof MENSAJES_CAT!=="undefined") ? MENSAJES_CAT : [];
  if (!mems.length) return;
  mems.forEach(function(m) {
    if (!m.nombre) return;
    PLAN_DIAS[m.nombre]   = m.dias   || 30;
    PLAN_PRECIO[m.nombre] = m.precio || 0;
    if (m.abonos && m.abonos.length) PLAN_ABONOS[m.nombre] = m.abonos;
  });
  ["f-plan","pago-plan"].forEach(function(sid) {
    var sel=ge(sid); if (!sel) return;
    var actual=sel.value;
    sel.innerHTML="<option value=''>— Selecciona —</option>";
    mems.forEach(function(m) {
      if (!m.nombre) return;
      var o=document.createElement("option"); o.value=m.nombre;
      o.textContent=m.nombre+" · $"+(m.precio||0).toLocaleString("es-MX");
      sel.appendChild(o);
    });
    if (actual) sel.value=actual;
  });
  // WA select
  var waSel=ge("wa-tipo");
  if (waSel) {
    waSel.innerHTML="<option value=''>— Selecciona —</option>";
    msgs.forEach(function(m,i) {
      var o=document.createElement("option"); o.value=String(i+1); o.textContent=m.nombre; waSel.appendChild(o);
    });
  }
}

// ──────────────────────────────────────────────────────────────
// DETALLE: las 4 pestañas — idénticas en admin y trainer
// ──────────────────────────────────────────────────────────────

function renderDetalle() {
  if (!socioActual) { showScreen("socios"); return; }
  var s=socioActual;
  ge("det-nombre").textContent=s.nombre+" "+s.apellido_paterno;
  ge("det-sub").textContent="#"+s.id+" · "+(s.plan||"Sin plan");
  document.querySelectorAll(".tab[data-det]").forEach(function(b){
    b.classList.toggle("active", b.dataset.det===detTab);
  });
  if      (detTab==="membresia")    renderTabMembresia(s);
  else if (detTab==="deudas")       renderTabDeudas(s);
  else if (detTab==="info")         renderTabInfo(s);
  else if (detTab==="seguimiento")  renderTabSeguimiento(s);
}

// ── TAB: MEMBRESÍA ─────────────────────────────────────────────
function renderTabMembresia(s) {
  var st=calcStatus(s), abonos=s.abonos||[], hist=s.historial_membresias||[];
  var hoy=new Date(); hoy.setHours(0,0,0,0);
  var h="<div class='sec' style='padding-bottom:24px'>";
  h+="<div class='lbl-sec'>Membresía activa</div>";

  if (s.plan) {
    h+="<div class='card "+(st==="aldia"?"verde":st==="vencehoy"?"naranja":"roja")+"' style='margin-bottom:8px'>";
    h+="<div style='display:flex;justify-content:space-between;align-items:center'>";
    h+="<div><div style='font-family:\"Bebas Neue\",sans-serif;font-size:22px'>"+s.plan+"</div>";
    h+="<div style='font-size:12px;color:var(--muted)'>Inicio: "+fF(s.fecha_inicio)+" · Vence: "+fF(s.fecha_vencimiento)+"</div></div>"+pillSt(st)+"</div>";
    if (abonos.length) {
      var pag=abonos.filter(function(a){return a.pagado;}).length;
      h+="<div class='prog-wrap' style='margin-top:10px'><div class='prog-fill' style='width:"+Math.round((pag/abonos.length)*100)+"%'></div></div>";
      h+="<div style='font-size:11px;color:var(--muted);margin-top:4px'>"+pag+"/"+abonos.length+" abonos · "+fm(abonos.filter(function(a){return a.pagado;}).reduce(function(t,a){return t+a.monto;},0))+" pagado</div>";
    }
    h+="</div>";
    if (abonos.length) {
      h+="<div class='card' style='margin-bottom:8px'>";
      abonos.forEach(function(a) {
        var lim=new Date(a.fecha_limite+"T00:00:00"), venc=!a.pagado&&lim<hoy;
        var cls=a.pagado?"aok":venc?"avenc":"apend";
        h+="<div class='abono-row'><div class='abono-num "+cls+"'>"+(a.pagado?"✓":a.num)+"</div>";
        h+="<div style='flex:1;min-width:0'><div style='font-size:13px;font-weight:600'>Abono "+a.num+(a.pagado?" · Pagado":venc?" · Vencido":" · Pendiente")+"</div>";
        h+="<div style='font-size:11px;color:var(--muted)'>"+(a.pagado?"Pagado: "+fF(a.fecha_pago):"Límite: "+fF(a.fecha_limite))+"</div></div>";
        h+="<div style='font-family:\"Bebas Neue\",sans-serif;font-size:18px;color:"+(a.pagado?"var(--green)":venc?"var(--red)":"var(--orange)")+"'>"+fm(a.monto)+"</div></div>";
      });
      h+="</div>";
    }
  } else {
    h+="<div style='font-size:13px;color:var(--muted);padding:8px 0'>Sin membresía activa</div>";
  }

  h+="<div style='display:flex;gap:8px;margin-bottom:16px'>";
  h+="<button class='btn bl bsm' id='btn-renovar' style='flex:1;justify-content:center'>+ Renovar</button>";
  if (s.plan) h+="<button class='btn br bsm' id='btn-del-memb'>Eliminar</button>";
  h+="</div>";

  if (hist.length) {
    h+="<div class='lbl-sec'>Historial (últimas "+Math.min(hist.length,12)+")</div>";
    hist.slice().sort(function(a,b){return (b.fecha_vencimiento||"").localeCompare(a.fecha_vencimiento||"");}).slice(0,12).forEach(function(item) {
      h+="<div class='card' style='margin-bottom:6px;display:flex;align-items:center;gap:10px'>";
      h+="<div style='flex:1'><div style='font-family:\"Bebas Neue\",sans-serif;font-size:15px'>"+item.plan+(item.eliminada?" <span class='pill pm' style='font-size:10px'>Eliminada</span>":"")+"</div>";
      h+="<div style='font-size:11px;color:var(--muted)'>"+fF(item.fecha_inicio)+" → "+fF(item.fecha_vencimiento)+"</div></div>";
      h+="<div style='font-family:\"Bebas Neue\",sans-serif;font-size:15px;color:var(--lime)'>"+fm(item.precio||0)+"</div></div>";
    });
  }
  h+="</div>";
  ge("det-content").innerHTML=h;

  ge("btn-renovar").addEventListener("click",function(){abrirModalPago(s);});
  var bd=ge("btn-del-memb");
  if (bd) bd.addEventListener("click",function(){
    if (!confirm("¿Eliminar membresía de "+s.nombre+"? El historial se conserva.")) return;
    if (!s.historial_membresias) s.historial_membresias=[];
    if (s.plan) s.historial_membresias.push({
      plan:s.plan, fecha_inicio:s.fecha_inicio, fecha_vencimiento:s.fecha_vencimiento,
      precio:PLAN_PRECIO[s.plan]||0, abonos:(s.abonos||[]).slice(), eliminada:true
    });
    s.plan=""; s.fecha_inicio=""; s.fecha_vencimiento=""; s.abonos=[];
    GymDB.setSocio(s);
    SOCIOS=GymDB.getSocios();
    socioActual=SOCIOS.find(function(x){return x.id===s.id;})||s;
    mostrarToast("Membresía eliminada"); renderDetalle();
  });
}

// ── TAB: DEUDAS ────────────────────────────────────────────────
function renderTabDeudas(s) {
  var deudas=DEUDAS[s.id]||[], totalD=deudas.reduce(function(a,d){return a+d.total;},0);
  var h="<div class='sec' style='padding-bottom:24px'>";
  h+="<div class='lbl-sec'>Deudas de productos</div>";
  if (!deudas.length) {
    h+="<div style='font-size:13px;color:var(--muted);padding:8px 0'>Sin deudas ✓</div>";
  } else {
    deudas.forEach(function(d) {
      h+="<div class='card' style='display:flex;align-items:center;gap:10px;margin-bottom:6px;border:1px solid rgba(255,59,48,.3)'>";
      h+="<div style='flex:1'><div style='font-weight:600;font-size:13px'>"+d.producto+"</div>";
      h+="<div style='font-size:11px;color:var(--muted)'>"+fF(d.fecha)+"</div></div>";
      h+="<div style='font-family:\"Bebas Neue\",sans-serif;font-size:18px;color:var(--red)'>"+fm(d.total)+"</div>";
      h+="<button class='btn bsm' style='background:rgba(255,59,48,.12);color:var(--red);border:1px solid rgba(255,59,48,.3)' data-cobrar-deuda='"+d.id+"' data-prod='"+encodeURIComponent(d.producto)+"' data-monto='"+d.total+"'>🗑</button></div>";
    });
    h+="<div style='text-align:right;font-size:12px;color:var(--red);margin-top:4px'>Total: "+fm(totalD)+"</div>";
  }
  h+="<div style='margin-top:12px'>";
  h+="<button class='btn bd bsm' id='btn-add-prod' style='width:100%;justify-content:center'>+ Agregar producto</button>";
  h+="<div id='panel-add-prod' style='display:none;margin-top:10px;background:var(--bg3);border-radius:12px;padding:12px;border:1px solid var(--border)'>";
  var prodOpts="<option value=''>— Selecciona —</option>";
  PRODUCTOS.forEach(function(p){prodOpts+="<option value='"+p.id+"'>"+p.nombre+" · "+fm(p.costo)+"</option>";});
  h+="<div class='fr'><label>Producto</label><select id='prod-select'>"+prodOpts+"</select></div>";
  h+="<div class='f2' style='gap:8px'><div class='fr'><label>Monto</label><input type='number' id='prod-monto' readonly></div>";
  h+="<div class='fr'><label>Estado</label><select id='prod-status'><option value='debe'>Debe</option><option value='pagado'>Pagado</option></select></div></div>";
  h+="<button class='btn bl' style='width:100%;justify-content:center;padding:11px' id='btn-guardar-prod'>Guardar</button>";
  h+="</div></div></div>";
  ge("det-content").innerHTML=h;

  // Toggle panel
  ge("btn-add-prod").addEventListener("click",function(){
    var p=ge("panel-add-prod"); p.style.display=p.style.display==="none"?"block":"none";
  });
  // Auto-fill monto
  ge("prod-select").addEventListener("change",function(){
    var p=PRODUCTOS.find(function(x){return x.id===+this.value;},this);
    ge("prod-monto").value=p?p.costo:"";
  });
  // Guardar producto
  ge("btn-guardar-prod").addEventListener("click",function(){
    var prodId=+ge("prod-select").value, status=ge("prod-status").value;
    if (!prodId){alert("Selecciona un producto");return;}
    var p=PRODUCTOS.find(function(x){return x.id===prodId;}); if (!p) return;
    var hoyStr=new Date().toISOString().slice(0,10);
    if (status==="debe"){
      if (!DEUDAS[s.id]) DEUDAS[s.id]=[];
      DEUDAS[s.id].push({id:"d"+Date.now(),producto:p.nombre,total:p.costo,fecha:hoyStr});
      GymDB.saveAllDeudas(DEUDAS);
    }
    var venta={id:"v"+Date.now(),socio_id:s.id,socio_nombre:s.nombre+" "+s.apellido_paterno,
      producto:p.nombre,cantidad:1,total:p.costo,fecha:hoyStr,status:status,tipo:"venta"};
    VENTAS.unshift(venta); GymDB.saveVentas(VENTAS);
    p.stock=Math.max(0,p.stock-1); GymDB.saveProductos(PRODUCTOS);
    if (typeof onRegistrarVenta==="function") onRegistrarVenta(p,venta);
    mostrarToast("✓ Producto registrado");
    renderDetalle();
  });
  // Cobrar deuda
  ge("det-content").querySelectorAll("[data-cobrar-deuda]").forEach(function(btn){
    btn.addEventListener("click",function(){
      _cobroPendiente={socioId:s.id,socioNombre:s.nombre+" "+s.apellido_paterno,
        deudaId:this.dataset.cobrarDeuda,
        producto:decodeURIComponent(this.dataset.prod),
        monto:+this.dataset.monto};
      ge("cobrar-info").textContent="Cobrar "+_cobroPendiente.producto+" · "+fm(_cobroPendiente.monto)+" de "+_cobroPendiente.socioNombre;
      ge("cobrar-codigo").value=""; ge("cobrar-error").textContent="";
      ge("modal-cobrar-deuda").classList.add("open");
    });
  });
}

// ── TAB: INFORMACIÓN ───────────────────────────────────────────
function renderTabInfo(s) {
  var h="<div class='sec' style='padding-bottom:24px'>";
  h+="<div class='f2' style='margin-bottom:12px'>";
  h+="<div><div class='lbl-campo'>Teléfono</div><div class='val-campo'>"+(s.numero||"—")+"</div></div>";
  h+="<div><div class='lbl-campo'>Emergencia</div><div class='val-campo'>"+(s.numero_emergencia||"—")+"</div></div></div>";
  h+="<div style='margin-bottom:12px'><div class='lbl-campo'>Correo</div><div class='val-campo'>"+(s.correo||"—")+"</div></div>";
  h+="<div class='f2' style='margin-bottom:12px'>";
  h+="<div><div class='lbl-campo'>Nacimiento</div><div class='val-campo'>"+fF(s.fecha_nacimiento)+"</div></div>";
  h+="<div><div class='lbl-campo'>Alta</div><div class='val-campo'>"+fF(s.fecha_inicio)+"</div></div></div>";
  h+="<div class='f2' style='margin-bottom:12px'>";
  h+="<div><div class='lbl-campo'>Sexo</div><div class='val-campo'>"+(s.sexo==="M"?"Masculino":s.sexo==="F"?"Femenino":"—")+"</div></div>";
  h+="<div><div class='lbl-campo'>Visitas</div><div style='font-family:\"Bebas Neue\",sans-serif;font-size:26px;color:var(--lime);margin-top:2px'>"+(s.visitas||0)+"</div></div></div>";
  if (s.notas) h+="<div style='margin-bottom:12px'><div class='lbl-campo'>Notas</div><div style='font-size:13px;color:var(--muted);margin-top:3px'>"+s.notas+"</div></div>";
  h+="<div style='display:flex;gap:8px;margin-top:8px'>";
  h+="<button class='btn bwa bsm' id='btn-info-wa' style='flex:1;justify-content:center'>&#128241; WhatsApp</button>";
  if (typeof onToggleActivo==="function")
    h+="<button class='btn bsm' id='btn-toggle-activo' style='flex:1;justify-content:center;background:"+(s.activo?"rgba(255,59,48,.12)":"rgba(48,209,88,.12)")+";color:"+(s.activo?"var(--red)":"var(--green)")+";border:1px solid "+(s.activo?"rgba(255,59,48,.3)":"rgba(48,209,88,.3)")+"'>"+(s.activo?"Desactivar":"Activar")+"</button>";
  h+="</div>";
  h+="<div style='margin-top:8px'><button class='btn bd bsm' id='btn-editar-soc' style='width:100%;justify-content:center'>✏️ Editar información</button></div>";
  h+="</div>";
  ge("det-content").innerHTML=h;

  ge("btn-info-wa").addEventListener("click",function(){abrirWA(s.id);});
  ge("btn-editar-soc").addEventListener("click",function(){abrirEditarSoc(s.id);});
  var btog=ge("btn-toggle-activo");
  if (btog && typeof onToggleActivo==="function") btog.addEventListener("click",function(){onToggleActivo(s);});
}

// ── TAB: SEGUIMIENTO ───────────────────────────────────────────
function renderTabSeguimiento(s) {
  var h="<div class='sec' style='padding-bottom:24px'>";
  h+="<div class='lbl-sec'>Nuevo registro</div>";
  h+="<div class='card' style='margin-bottom:14px'>";
  h+="<div class='f2'>";
  h+="<div class='fr'><label>Peso (kg)</label><input type='number' id='seg-peso' placeholder='75.5' step='0.1' inputmode='decimal'></div>";
  h+="<div class='fr'><label>IMC</label><input type='number' id='seg-imc' placeholder='22.5' step='0.1' inputmode='decimal'></div>";
  h+="</div><div class='f2' style='margin-top:8px'>";
  h+="<div class='fr'><label>Músculo (kg)</label><input type='number' id='seg-musculo' placeholder='32.0' step='0.1' inputmode='decimal'></div>";
  h+="<div class='fr'><label>% Grasa</label><input type='number' id='seg-grasa' placeholder='18.5' step='0.1' inputmode='decimal'></div>";
  h+="</div><div class='fr' style='margin-top:8px'><label>Fecha</label><input type='date' id='seg-fecha'></div>";
  h+="<button class='btn bl bfull' style='margin-top:12px' id='btn-guardar-seg'>Guardar medidas</button>";
  h+="</div>";
  h+="<div class='lbl-sec'>Historial (últimos 12)</div>";
  h+="<div id='seg-historial'><div style='font-size:13px;color:var(--muted)'>Cargando…</div></div>";
  h+="</div>";
  ge("det-content").innerHTML=h;
  ge("seg-fecha").value=new Date().toISOString().slice(0,10);

  GymDB.getSeguimiento(s.id, function(hist) {
    if (hist.length) {
      var ul=hist[0];
      if (ul.peso)    ge("seg-peso").value=ul.peso;
      if (ul.musculo) ge("seg-musculo").value=ul.musculo;
      if (ul.imc)     ge("seg-imc").value=ul.imc;
      if (ul.grasa)   ge("seg-grasa").value=ul.grasa;
    }
    if (!hist.length) {
      ge("seg-historial").innerHTML="<div style='font-size:13px;color:var(--muted);padding:8px 0'>Sin registros aún</div>";
    } else {
      var hh="";
      hist.slice(0,12).forEach(function(item) {
        var d=new Date((item.fecha||item.mes+"-01")+"T00:00:00");
        var label=d.toLocaleDateString("es-MX",{day:"numeric",month:"short",year:"numeric"});
        hh+="<div class='card' style='margin-bottom:8px'>";
        hh+="<div style='font-size:12px;font-weight:700;color:var(--muted);margin-bottom:8px'>"+label+"</div>";
        hh+="<div style='display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;text-align:center'>";
        hh+="<div><div style='font-family:Bebas Neue,sans-serif;font-size:20px;color:#4ECDC4'>"+(item.peso||"—")+"</div><div style='font-size:10px;color:var(--muted)'>kg peso</div></div>";
        hh+="<div><div style='font-family:Bebas Neue,sans-serif;font-size:20px;color:var(--green)'>"+(item.musculo||"—")+"</div><div style='font-size:10px;color:var(--muted)'>kg musc.</div></div>";
        hh+="<div><div style='font-family:Bebas Neue,sans-serif;font-size:20px;color:var(--lime)'>"+(item.imc||"—")+"</div><div style='font-size:10px;color:var(--muted)'>IMC</div></div>";
        hh+="<div><div style='font-family:Bebas Neue,sans-serif;font-size:20px;color:var(--orange)'>"+(item.grasa||"—")+"</div><div style='font-size:10px;color:var(--muted)'>% grasa</div></div>";
        hh+="</div></div>";
      });
      ge("seg-historial").innerHTML=hh;
    }
  });

  ge("btn-guardar-seg").addEventListener("click",function(){
    var peso=parseFloat(ge("seg-peso").value)||null;
    var musculo=parseFloat(ge("seg-musculo").value)||null;
    var imc=parseFloat(ge("seg-imc").value)||null;
    var grasa=parseFloat(ge("seg-grasa").value)||null;
    var fecha=ge("seg-fecha").value||new Date().toISOString().slice(0,10);
    if (!peso&&!musculo&&!imc&&!grasa){alert("Ingresa al menos un valor");return;}
    GymDB.saveSeguimiento(s.id, fecha, peso, musculo, imc, grasa, fecha, function(){
      if (peso) s.peso=peso; if (musculo) s.musculo=musculo;
      GymDB.setSocio(s);
      mostrarToast("✓ Medidas guardadas");
      renderTabSeguimiento(s);
    });
  });
}

// ──────────────────────────────────────────────────────────────
// MODAL PAGO / RENOVAR MEMBRESÍA
// ──────────────────────────────────────────────────────────────
function abrirModalPago(s) {
  ge("pago-titulo").textContent="Renovar membresía";
  ge("pago-plan").value=s.plan||"";
  ge("pago-tipo").value="completo";
  ge("pago-inicio").value=new Date().toISOString().slice(0,10);
  actualizarResumenPago();
  ge("modal-pago").classList.add("open");
}

function actualizarResumenPago() {
  var plan=ge("pago-plan").value, tipo=ge("pago-tipo").value;
  var fi=ge("pago-inicio").value;
  var precio=PLAN_PRECIO[plan]||0, dias=PLAN_DIAS[plan]||30;
  // Base real de inicio: encadena si la membresía actual aún está vigente
  var baseInicio=fi;
  if (socioActual&&socioActual.fecha_vencimiento) {
    var hoyDate=new Date(); hoyDate.setHours(0,0,0,0);
    var fvDate=new Date(socioActual.fecha_vencimiento+"T00:00:00");
    if (fvDate>hoyDate) baseInicio=socioActual.fecha_vencimiento;
  }
  var fv=baseInicio?addDays(baseInicio,dias):"—";
  var html="<strong>Plan:</strong> "+plan+"<br><strong>Inicia:</strong> "+fF(baseInicio)+" <em style='font-size:10px;color:var(--muted)'>(encadena al plan actual si está vigente)</em><br><strong>Vence:</strong> "+fF(fv)+"<br>";
  if (tipo==="parcial"&&PLAN_ABONOS[plan]&&PLAN_ABONOS[plan].length) {
    PLAN_ABONOS[plan].forEach(function(a,i){
      html+="· Abono "+(i+1)+": "+fm(a.monto)+" → "+fF(fi?addWeeks(fi,a.semanas):"—")+"<br>";
    });
  } else {
    html+="<strong>Pago único:</strong> "+fm(precio);
  }
  ge("pago-resumen").innerHTML=html;
}

function guardarPago() {
  var plan=ge("pago-plan").value, tipo=ge("pago-tipo").value;
  var fi=ge("pago-inicio").value, s=socioActual;
  if (!s||!fi||!plan){alert("Completa todos los campos");return;}

  var hoy=new Date(); hoy.setHours(0,0,0,0);
  var fvActual=s.fecha_vencimiento?new Date(s.fecha_vencimiento+"T00:00:00"):null;

  // Historial: guardar la membresía que se va a sobreescribir
  if (!s.historial_membresias) s.historial_membresias=[];
  if (s.plan&&s.fecha_vencimiento) {
    s.historial_membresias.push({
      plan:s.plan, fecha_inicio:s.fecha_inicio, fecha_vencimiento:s.fecha_vencimiento,
      precio:PLAN_PRECIO[s.plan]||0, abonos:(s.abonos||[]).slice()
    });
  }

  // Encadenamiento: si la membresía actual sigue vigente, la nueva arranca donde termina
  var baseInicio=(fvActual&&fvActual>hoy)?s.fecha_vencimiento:fi;

  s.plan=plan;
  s.fecha_inicio=baseInicio;
  s.fecha_vencimiento=addDays(baseInicio, PLAN_DIAS[plan]||30);

  if (tipo==="parcial"&&PLAN_ABONOS[plan]&&PLAN_ABONOS[plan].length) {
    s.abonos=PLAN_ABONOS[plan].map(function(a,i){
      return{num:i+1,monto:a.monto,fecha_limite:addWeeks(fi,a.semanas),pagado:false,fecha_pago:null};
    });
  } else {
    s.abonos=[{num:1,monto:PLAN_PRECIO[plan],fecha_limite:fi,pagado:true,fecha_pago:fi}];
  }

  // Hook para que cada vista registre el cobro a su manera
  if (typeof onGuardarPago==="function") onGuardarPago(s, plan, fi);

  GymDB.setSocio(s);
  SOCIOS=GymDB.getSocios();
  socioActual=SOCIOS.find(function(x){return x.id===s.id;})||s;
  ge("modal-pago").classList.remove("open");
  detTab="membresia"; renderDetalle();
}

// ──────────────────────────────────────────────────────────────
// WHATSAPP
// ──────────────────────────────────────────────────────────────
function abrirWA(id) {
  var msgs=(typeof MENSAJES_CAT!=="undefined")?MENSAJES_CAT:[];
  waTarget=SOCIOS.find(function(s){return s.id===id;}); if (!waTarget) return;
  ge("wa-para").textContent="Para: "+nCompleto(waTarget)+" · "+waTarget.numero;
  ge("wa-tipo").value=""; ge("wa-preview").textContent="Selecciona un tipo…";
  ge("modal-wa").classList.add("open");
}
function previewWA() {
  var msgs=(typeof MENSAJES_CAT!=="undefined")?MENSAJES_CAT:[];
  var idx=+ge("wa-tipo").value-1, m=msgs[idx];
  ge("wa-preview").textContent=m&&waTarget?m.cuerpo.replace(/\{nombre\}/g,waTarget.nombre).replace(/\{plan\}/g,waTarget.plan||""):"Selecciona un tipo…";
}
function enviarWA() {
  var msgs=(typeof MENSAJES_CAT!=="undefined")?MENSAJES_CAT:[];
  var idx=+ge("wa-tipo").value-1, m=msgs[idx];
  if (!m||!waTarget){alert("Selecciona un tipo");return;}
  var msg=m.cuerpo.replace(/\{nombre\}/g,waTarget.nombre).replace(/\{plan\}/g,waTarget.plan||"");
  window.open("https://wa.me/52"+waTarget.numero.replace(/\D/g,"")+"?text="+encodeURIComponent(msg),"_blank");
  ge("modal-wa").classList.remove("open");
}

// ──────────────────────────────────────────────────────────────
// FORMULARIO SOCIO (crear / editar)
// ──────────────────────────────────────────────────────────────
function abrirNuevoSoc() {
  socEditId=null; ge("form-titulo").textContent="Nuevo Socio";
  ["f-id","f-nombre","f-ap","f-am","f-tel","f-emerg","f-correo","f-notas"].forEach(function(i){ge(i).value="";});
  ge("f-vence").value=""; ge("f-inicio").value=""; ge("f-nac").value=""; ge("f-plan").value=""; ge("f-sexo").value="";
  showScreen("form");
}
function abrirEditarSoc(id) {
  var s=SOCIOS.find(function(x){return x.id===id;}); if (!s) return;
  socEditId=id; ge("form-titulo").textContent="Editar Socio";
  ge("f-id").value=s.id; ge("f-nombre").value=s.nombre; ge("f-ap").value=s.apellido_paterno; ge("f-am").value=s.apellido_materno||"";
  ge("f-tel").value=s.numero||""; ge("f-emerg").value=s.numero_emergencia||""; ge("f-correo").value=s.correo||"";
  ge("f-notas").value=s.notas||""; ge("f-vence").value=s.fecha_vencimiento||""; ge("f-inicio").value=s.fecha_inicio||"";
  ge("f-nac").value=s.fecha_nacimiento||""; ge("f-plan").value=s.plan||""; ge("f-sexo").value=s.sexo||"";
  showScreen("form");
}
function guardarSoc() {
  var id=ge("f-id").value.trim(), nombre=ge("f-nombre").value.trim(), ap=ge("f-ap").value.trim();
  if (!id||!nombre||!ap){alert("Número, nombre y apellido son requeridos");return;}
  var datos={id:id,nombre:nombre,apellido_paterno:ap,apellido_materno:ge("f-am").value.trim(),
    numero:ge("f-tel").value.trim(),numero_emergencia:ge("f-emerg").value.trim(),correo:ge("f-correo").value.trim(),
    notas:ge("f-notas").value.trim(),fecha_vencimiento:ge("f-vence").value,fecha_inicio:ge("f-inicio").value,
    fecha_nacimiento:ge("f-nac").value,plan:ge("f-plan").value,sexo:ge("f-sexo").value,visitas:0,activo:true,abonos:[]};
  var idx=SOCIOS.findIndex(function(x){return x.id===id;});
  if (idx>-1) {
    datos.visitas=SOCIOS[idx].visitas; datos.activo=SOCIOS[idx].activo;
    datos.abonos=SOCIOS[idx].abonos||[]; datos.historial_membresias=SOCIOS[idx].historial_membresias||[];
    SOCIOS[idx]=datos;
  } else {
    if (SOCIOS.find(function(x){return x.id===id;})){alert("Ya existe el número "+id);return;}
    SOCIOS.push(datos);
  }
  GymDB.saveSocios(SOCIOS);
  if (socioActual&&socioActual.id===id) socioActual=SOCIOS.find(function(x){return x.id===id;});
  showScreen("socios");
}

// ──────────────────────────────────────────────────────────────
// LISTA DE SOCIOS (misma lógica en ambas vistas)
// ──────────────────────────────────────────────────────────────
function renderSocios() {
  var q=(ge("soc-buscar").value||"").toLowerCase();
  var lista=SOCIOS.filter(function(s){
    if (!q) return true;
    return (s.nombre+" "+s.apellido_paterno+" "+s.id+" "+(s.plan||"")).toLowerCase().indexOf(q)>-1;
  });
  lista.sort(function(a,b){
    var va,vb;
    if (SORT_ACTUAL==="id"){ va=+a.id||0; vb=+b.id||0; }
    else if (SORT_ACTUAL==="nombre"){ va=a.nombre; vb=b.nombre; }
    else if (SORT_ACTUAL==="vencimiento"){ va=a.fecha_vencimiento||""; vb=b.fecha_vencimiento||""; }
    else if (SORT_ACTUAL==="plan"){ va=a.plan||""; vb=b.plan||""; }
    else { va=a.visitas||0; vb=b.visitas||0; }
    if (va<vb) return ORDEN_ASC?-1:1; if (va>vb) return ORDEN_ASC?1:-1; return 0;
  });
  var html="";
  if (!lista.length) html="<div class='empty'><div class='ico'>&#128101;</div><p>Sin socios</p></div>";
  lista.forEach(function(s){
    var st=calcStatus(s);
    var deudas=DEUDAS[s.id]||[], totalD=deudas.reduce(function(a,d){return a+d.total;},0);
    var abonoV=(s.abonos||[]).find(function(a){
      var lim=new Date(a.fecha_limite+"T00:00:00"),h=new Date();h.setHours(0,0,0,0);
      return !a.pagado&&lim<h;
    });
    html+="<div class='soc-card "+st+"' data-ver='"+s.id+"'><div class='soc-fila'>";
    html+="<div class='soc-av' style='background:"+avColor(st)+"'>"+ini(s)+"</div>";
    html+="<div class='soc-info'><div class='soc-nombre'>#"+s.id+" · "+s.nombre+" "+s.apellido_paterno+"</div>";
    html+="<div class='soc-sub'>"+(s.plan||"Sin plan")+" · Vence: "+fF(s.fecha_vencimiento)+"</div>";
    html+="<div style='margin-top:4px;display:flex;gap:5px;flex-wrap:wrap'>"+pillSt(st);
    if (totalD>0) html+="<span class='pill po'>Debe: "+fm(totalD)+"</span>";
    if (abonoV)   html+="<span class='pill pr'>Abono vencido</span>";
    html+="</div></div><span style='color:var(--muted);font-size:18px'>›</span></div></div>";
  });
  ge("lista-socios").innerHTML=html;
  ge("lista-socios").querySelectorAll("[data-ver]").forEach(function(el){
    el.addEventListener("click",function(){
      socioActual=SOCIOS.find(function(s){return s.id===this.dataset.ver;},this);
      detTab="membresia"; showScreen("detalle");
    });
  });
}

// ──────────────────────────────────────────────────────────────
// INICIALIZAR EVENTOS COMPARTIDOS DEL DETALLE
// Llamar esta función UNA VEZ después de que el DOM esté listo
// ──────────────────────────────────────────────────────────────
function initDetalleEvents() {
  // Tabs del detalle
  document.querySelectorAll(".tab[data-det]").forEach(function(b){
    b.addEventListener("click",function(){
      detTab=this.dataset.det; renderDetalle();
    });
  });
  // Modal pago
  ge("pago-plan").addEventListener("change",actualizarResumenPago);
  ge("pago-tipo").addEventListener("change",actualizarResumenPago);
  ge("pago-inicio").addEventListener("change",actualizarResumenPago);
  ge("pago-guardar").addEventListener("click",guardarPago);
  // WA
  ge("wa-tipo").addEventListener("change",previewWA);
  ge("wa-enviar").addEventListener("click",enviarWA);
  // Formulario socio
  ge("btn-form-cancel").addEventListener("click",function(){showScreen("socios");});
  ge("btn-guardar-soc").addEventListener("click",guardarSoc);
  // Det volver / sync
  ge("btn-det-back").addEventListener("click",function(){showScreen("socios");});
  ge("btn-sync-det").addEventListener("click",function(){
    var b=this; b.textContent="…"; b.disabled=true;
    GymDB.init().then(function(){
      recargarDatos();
      if (socioActual) socioActual=SOCIOS.find(function(x){return x.id===socioActual.id;})||socioActual;
      renderDetalle(); b.textContent="↻"; b.disabled=false; mostrarToast("↻ Actualizado");
    });
  });
  // Cobrar deuda modal
  ge("cobrar-ok").addEventListener("click",function(){
    if (typeof confirmarCobro==="function") confirmarCobro();
  });
  // Socios sort/buscar
  ge("soc-buscar").addEventListener("input",renderSocios);
  ge("sort-sel").addEventListener("change",function(){SORT_ACTUAL=this.value;renderSocios();});
  ge("btn-orden-dir").addEventListener("click",function(){
    ORDEN_ASC=!ORDEN_ASC; this.textContent=ORDEN_ASC?"↑":"↓"; renderSocios();
  });
  ge("btn-nuevo-soc").addEventListener("click",abrirNuevoSoc);
  // Cerrar modales con backdrop
  document.querySelectorAll(".modal-ov").forEach(function(el){
    el.addEventListener("click",function(e){if(e.target===this) this.classList.remove("open");});
  });
  document.querySelectorAll("[data-close]").forEach(function(b){
    b.addEventListener("click",function(){ge(this.dataset.close).classList.remove("open");});
  });
}

// Variables de estado de la lista (deben existir globalmente, cada vista las inicializa)
var SORT_ACTUAL = "id";
var ORDEN_ASC   = true;
