import {
  collection,
  getDocs,
  orderBy,
  query,
  doc,
  updateDoc,
  getDoc,
  Timestamp,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { auth, db } from "./firebase.js";

/* =============================
   AUTH
============================= */
onAuthStateChanged(auth, user => {
  if (!user) window.location.href = "login.html";
});

/* =============================
   REFS
============================= */
const Swal             = window.Swal;
const listaVentas      = document.getElementById("ventas");
const listaRecaudacion = document.getElementById("recaudacion");
const filtroMes        = document.getElementById("filtroMes");
const filtroDia        = document.getElementById("filtroDia");
const filtroAnio       = document.getElementById("filtroAnio");

const totalHoySpan      = document.getElementById("totalHoy");
const efectivoHoySpan   = document.getElementById("efectivoHoy");
const posnetHoySpan     = document.getElementById("posnetHoy");
const trsfDanyHoySpan   = document.getElementById("trsfDanyHoy");
const trsfAnaHoySpan    = document.getElementById("trsfAnaHoy");
const noEfectivoHoySpan = document.getElementById("noEfectivoHoy");

const costoEstimadoSpan    = document.getElementById("costoEstimado");
const gananciaEstimadaSpan = document.getElementById("gananciaEstimada");
const margenEstimadoSpan   = document.getElementById("margenEstimado");
const gananciaPorProducto  = document.getElementById("gananciaPorProducto");

let ventasGlobal   = [];
let graficoSemanal = null;
let graficoMensual = null;

/* =============================
   SELECT DE AÑO
============================= */
(function poblarAnios() {
  const anioActual = new Date().getFullYear();
  for (let y = anioActual; y >= anioActual - 5; y--) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    filtroAnio.appendChild(opt);
  }
})();

/* =============================
   CACHE DE PRODUCTOS (para el precio de compra)
   Se pide una sola vez a Firestore y se reutiliza,
   aunque cambies de filtro varias veces.
============================= */
let productosCache = null;

async function getProductosCache() {
  if (productosCache) return productosCache;

  const snap = await getDocs(collection(db, "productos"));
  productosCache = {};
  snap.forEach(d => { productosCache[d.id] = d.data(); });

  return productosCache;
}

/* =============================
   ESTADO VACÍO
============================= */
function mostrarEstadoVacio() {
  listaVentas.innerHTML      = `<li style="color:#888; padding:12px;">Seleccioná un día, mes o año para ver las ventas.</li>`;
  listaRecaudacion.innerHTML = "";
  totalHoySpan.textContent      = "$0";
  efectivoHoySpan.textContent   = "$0";
  posnetHoySpan.textContent     = "$0";
  trsfDanyHoySpan.textContent   = "$0";
  trsfAnaHoySpan.textContent    = "$0";
  noEfectivoHoySpan.textContent = "$0";
  document.getElementById("cantidadVentas").textContent = 0;
  document.getElementById("promedioVentas").textContent = "$0";
  document.getElementById("ventasPorCategoria").innerHTML = "";
  document.getElementById("ventasPorHora").innerHTML = "";

  costoEstimadoSpan.textContent    = "$0";
  gananciaEstimadaSpan.textContent = "$0";
  margenEstimadoSpan.textContent   = "0%";
  gananciaPorProducto.innerHTML    = `<li style="color:#888; padding:12px;">Seleccioná un día, mes o año para estimar la ganancia.</li>`;

  if (graficoSemanal) { graficoSemanal.destroy(); graficoSemanal = null; }
  if (graficoMensual) { graficoMensual.destroy(); graficoMensual = null; }
}

function renderVentasPorCategoria(ventas) {
  const lista = document.getElementById("ventasPorCategoria");
  lista.innerHTML = "";

  const validas = ventas.filter(v => !v.anulada);
  const mapa = {};

  validas.forEach(v => {
    v.items?.forEach(item => {
      const cat = item.categoria || "Sin categoría";
      if (!mapa[cat]) mapa[cat] = 0;
      mapa[cat] += item.precio_venta * item.cantidad;
    });
  });

  if (Object.keys(mapa).length === 0) {
    lista.innerHTML = `<li style="color:#888;">Sin datos.</li>`;
    return;
  }

  Object.entries(mapa)
    .sort((a, b) => b[1] - a[1]) // mayor a menor
    .forEach(([cat, total]) => {
      const li = document.createElement("li");
      li.textContent = `${cat}: $${total}`;
      lista.appendChild(li);
    });
}

/* =============================
   GANANCIA ESTIMADA DEL PERÍODO
   Prioridad para el costo de cada item:
   1) item.precio_compra — la "foto" que venta.js guarda en el
      momento exacto de la venta (exacta, no cambia nunca más)
   2) precio_compra ACTUAL del producto — solo como respaldo,
      para ventas viejas guardadas antes de este cambio
   3) sin costo — productos sueltos o borrados del catálogo
============================= */
async function calcularGanancia(ventas) {
  const productosMap = await getProductosCache();
  const validas = ventas.filter(v => !v.anulada);

  let costoTotal      = 0;
  let ventaTotalReal   = 0; // usa v.total, así ya viene con el descuento aplicado
  let unidadesSinCosto = 0; // sueltos o productos borrados, no tienen precio_compra

  const porProducto = {};

  validas.forEach(v => {
    ventaTotalReal += v.total;

    v.items?.forEach(item => {
      const ventaItem = item.precio_venta * item.cantidad;

      let costoUnit;
      if (item.precio_compra !== undefined && item.precio_compra !== null) {
        // Venta nueva: ya trae el costo congelado del momento de la venta
        costoUnit = Number(item.precio_compra) || 0;
      } else if (!item.suelto && productosMap[item.id]) {
        // Venta vieja (de antes de este cambio): aproximamos con el costo actual
        costoUnit = Number(productosMap[item.id].precio_compra) || 0;
      } else {
        // Producto suelto, o borrado del catálogo: no hay forma de saberlo
        costoUnit = null;
      }

      if (costoUnit === null) {
        unidadesSinCosto += item.cantidad;
      } else {
        costoTotal += costoUnit * item.cantidad;
      }

      const key = item.id;
      if (!porProducto[key]) {
        porProducto[key] = {
          nombre: item.nombre,
          cantidad: 0,
          ventaTotal: 0,
          costoTotal: 0,
          sinCosto: costoUnit === null
        };
      }
      porProducto[key].cantidad   += item.cantidad;
      porProducto[key].ventaTotal += ventaItem;
      if (costoUnit !== null) porProducto[key].costoTotal += costoUnit * item.cantidad;
    });
  });

  const gananciaEstimada = ventaTotalReal - costoTotal;
  const margenProm = costoTotal > 0 ? (gananciaEstimada / costoTotal) * 100 : 0;

  return { costoTotal, gananciaEstimada, margenProm, porProducto, unidadesSinCosto };
}

function renderGanancia(resultado) {
  costoEstimadoSpan.textContent    = "$" + resultado.costoTotal.toLocaleString("es-AR");
  gananciaEstimadaSpan.textContent = "$" + resultado.gananciaEstimada.toLocaleString("es-AR");
  margenEstimadoSpan.textContent   = resultado.margenProm.toFixed(1) + "%";

  gananciaPorProducto.innerHTML = "";

  const productos = Object.values(resultado.porProducto)
    .sort((a, b) => b.ventaTotal - a.ventaTotal);

  if (productos.length === 0) {
    gananciaPorProducto.innerHTML = `<li style="color:#888;">Sin datos.</li>`;
    return;
  }

  productos.forEach(p => {
    const ganancia = p.ventaTotal - p.costoTotal;
    const color = p.sinCosto ? "#888" : (ganancia >= 0 ? "#1f8f3a" : "#c0392b");

    const li = document.createElement("li");
    li.innerHTML = p.sinCosto
      ? `${p.nombre} x${p.cantidad} — sin precio de compra cargado (no se estima)`
      : `${p.nombre} x${p.cantidad} — venta $${p.ventaTotal} / costo $${p.costoTotal} → <b style="color:${color}">$${ganancia}</b>`;
    gananciaPorProducto.appendChild(li);
  });

  if (resultado.unidadesSinCosto > 0) {
    const aviso = document.createElement("li");
    aviso.style.color = "#888";
    aviso.textContent = `⚠️ ${resultado.unidadesSinCosto} unidad(es) vendidas sin precio de compra cargado (productos sueltos o eliminados) no entran en el cálculo de costo.`;
    gananciaPorProducto.appendChild(aviso);
  }
}

/* =============================
   CONSTRUIR RANGO DE FECHAS
============================= */
function getRango() {
  // Prioridad: día > mes > año
  if (filtroDia.value) {
    const [y, m, d] = filtroDia.value.split("-").map(Number);
    return {
      inicio: new Date(y, m - 1, d, 0, 0, 0),
      fin:    new Date(y, m - 1, d, 23, 59, 59)
    };
  }

  if (filtroMes.value) {
    const [y, m] = filtroMes.value.split("-").map(Number);
    return {
      inicio: new Date(y, m - 1, 1, 0, 0, 0),
      fin:    new Date(y, m,     0, 23, 59, 59) // día 0 del mes siguiente = último día del mes
    };
  }

  if (filtroAnio.value) {
    const y = Number(filtroAnio.value);
    return {
      inicio: new Date(y, 0, 1, 0, 0, 0),
      fin:    new Date(y, 11, 31, 23, 59, 59)
    };
  }

  return null;
}

/* =============================
   CARGAR VENTAS (solo cuando hay filtro)
============================= */
async function cargarVentas() {
  const rango = getRango();


  if (!rango) {
    mostrarEstadoVacio();
    return;
  }

  listaVentas.innerHTML = `<li style="color:#888; padding:12px;">Cargando...</li>`;

  const q = query(
    collection(db, "ventas"),
    where("fecha", ">=", Timestamp.fromDate(rango.inicio)),
    where("fecha", "<=", Timestamp.fromDate(rango.fin)),
    orderBy("fecha", "desc")
  );

  const snap = await getDocs(q);
  ventasGlobal = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  renderVentas(ventasGlobal);
  renderGraficos(ventasGlobal);
  renderGraficoMensual(ventasGlobal);
  calcularCaja(ventasGlobal);
  renderRecaudacion(ventasGlobal);
  renderVentasPorCategoria(ventasGlobal);
  renderVentasPorHora(ventasGlobal);

  const resultadoGanancia = await calcularGanancia(ventasGlobal);
  renderGanancia(resultadoGanancia);
}

/* =============================
   PAGOS POR VENTA
   Ventas nuevas traen v.pagos (desglose real, soporta pago
   dividido entre varios medios). Ventas viejas solo tienen
   v.medioPago + v.total: las tratamos como un pago único.
============================= */
function pagosDeVenta(v) {
  if (Array.isArray(v.pagos) && v.pagos.length > 0) return v.pagos;
  return [{ medio: v.medioPago, monto: v.total }];
}

const MEDIO_PAGO_INFO = {
  efectivo:  { label: "💵 Efectivo",            color: "#1f8f3a" },
  posnet:    { label: "💳 POSNET",              color: "#1565c0" },
  trsf_dany: { label: "📲 Transferencia Dany",  color: "#8e24aa" },
  trsf_ana:  { label: "📲 Transferencia Ana",   color: "#ef6c00" }
};

/* =============================
   CAJA DEL DÍA/PERÍODO
============================= */
function calcularCaja(ventas) {
  const validas = ventas.filter(v => !v.anulada);

  let total    = 0;
  let efectivo = 0;
  let posnet   = 0;
  let trsfDany = 0;
  let trsfAna  = 0;

  validas.forEach(v => {
    total += v.total;

    pagosDeVenta(v).forEach(p => {
      switch (p.medio) {
        case "efectivo":   efectivo += p.monto;  break;
        case "posnet":     posnet   += p.monto;  break;
        case "trsf_dany":  trsfDany += p.monto;  break;
        case "trsf_ana":   trsfAna  += p.monto;  break;
      }
    });
  });

  const cantidad = validas.length;
  const promedio = cantidad > 0 ? Math.round(total / cantidad) : 0;

  totalHoySpan.textContent      = "$" + total.toLocaleString("es-AR");
  efectivoHoySpan.textContent   = "$" + efectivo.toLocaleString("es-AR");
  posnetHoySpan.textContent     = "$" + posnet.toLocaleString("es-AR");
  trsfDanyHoySpan.textContent   = "$" + trsfDany.toLocaleString("es-AR");
  trsfAnaHoySpan.textContent    = "$" + trsfAna.toLocaleString("es-AR");
  noEfectivoHoySpan.textContent = "$" + (posnet + trsfDany + trsfAna).toLocaleString("es-AR");

  document.getElementById("cantidadVentas").textContent = cantidad;
  document.getElementById("promedioVentas").textContent = "$" + promedio.toLocaleString("es-AR");
}

/* =============================
   RECAUDACIÓN
============================= */
function renderRecaudacion(ventas) {
  listaRecaudacion.innerHTML = "";

  const validas = ventas.filter(v => !v.anulada);
  const total   = validas.reduce((acc, v) => acc + v.total, 0);

  if (total === 0) return;

  let label = "";
  if (filtroDia.value) label = filtroDia.value.split("-").reverse().join("/");
  else if (filtroMes.value) label = filtroMes.value;
  else if (filtroAnio.value) label = `Año ${filtroAnio.value}`;

  const li = document.createElement("li");
  li.textContent = `📅 ${label} — $${total.toLocaleString("es-AR")}`;
  listaRecaudacion.appendChild(li);
}

/* =============================
   LISTA VENTAS
============================= */
function renderVentas(ventas) {
  listaVentas.innerHTML = "";

  if (ventas.length === 0) {
    listaVentas.innerHTML = `<li style="color:#888; padding:12px;">Sin ventas en este período.</li>`;
    return;
  }

  ventas.forEach(v => {
    const fecha   = v.fecha?.toDate().toLocaleString() || "—";
    const cliente = v.cliente || "Consumidor final";

    const pagos = pagosDeVenta(v);
    let medioTexto;
    let color;
    let tooltip = "";

    if (pagos.length > 1) {
      medioTexto = "🔀 Mixto";
      color = "#6d28d9";
      tooltip = pagos
        .map(p => `${(MEDIO_PAGO_INFO[p.medio]?.label || p.medio)}: $${p.monto.toLocaleString("es-AR")}`)
        .join(" · ");
    } else {
      const info = MEDIO_PAGO_INFO[pagos[0]?.medio];
      medioTexto = info ? info.label : "—";
      color = info ? info.color : "gray";
    }

    const li = document.createElement("li");
    li.className = "venta-item" + (v.anulada ? " anulada" : "");

    const badge = `<span class="venta-badge" style="color:${color}; border-color:${color};" title="${tooltip}">${medioTexto}</span>`;

    li.innerHTML = v.anulada
      ? `<div class="venta-info">
           <span>❌ <b>${fecha}</b> — ${cliente} — $${v.total.toLocaleString("es-AR")}</span>
           ${badge}
           <span class="venta-anulada-tag">ANULADA</span>
         </div>`
      : `<div class="venta-info">
           <span><b>${fecha}</b> — ${cliente} — $${v.total.toLocaleString("es-AR")}</span>
           ${badge}
         </div>
         <div class="venta-acciones">
           <button onclick="verDetalleVenta('${v.id}')" title="Ver detalle">📦</button>
           <button onclick="anularVenta('${v.id}')" title="Anular venta">Anular</button>
         </div>`;

    listaVentas.appendChild(li);
  });
}


function renderVentasPorHora(ventas) {
  const lista = document.getElementById("ventasPorHora");
  lista.innerHTML = "";
  
  const validas = ventas.filter(v => !v.anulada);
  const franjas = Array(24).fill(0);

  validas.forEach(v => {
    const hora = v.fecha.toDate().getHours();
    franjas[hora]++;
  });

  const max = Math.max(...franjas);

  if (max === 0) {
    lista.innerHTML = `<li style="color:#888;">Sin datos.</li>`;
    return;
  }

  franjas.forEach((cant, hora) => {
    if (cant === 0) return;
    const horaFin = hora + 1;
    const estrellitas = cant === max ? " ⭐" : "";
    const li = document.createElement("li");
    li.textContent = `${String(hora).padStart(2,"0")}:00 - ${String(horaFin).padStart(2,"0")}:00 → ${cant} venta${cant > 1 ? "s" : ""}${estrellitas}`;
    lista.appendChild(li);
  });
}

/* =============================
   GRÁFICO SEMANAL
============================= */
function renderGraficos(ventas) {
  const validas = ventas.filter(v => !v.anulada);
  const dias    = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const data    = Array(7).fill(0);

  validas.forEach(v => {
    data[v.fecha.toDate().getDay()] += v.total;
  });

  if (graficoSemanal) graficoSemanal.destroy();

  graficoSemanal = new Chart(
    document.getElementById("graficoSemanal"),
    {
      type: "bar",
      data: { labels: dias, datasets: [{ data, backgroundColor: "#16a34a", borderRadius: 6 }] },
      options: { plugins: { legend: { display: false } } }
    }
  );
}

/* =============================
   GRÁFICO MENSUAL (útil sobre todo al filtrar por año)
============================= */
function renderGraficoMensual(ventas) {
  const validas = ventas.filter(v => !v.anulada);
  const meses   = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const data    = Array(12).fill(0);

  validas.forEach(v => {
    data[v.fecha.toDate().getMonth()] += v.total;
  });

  if (graficoMensual) graficoMensual.destroy();

  graficoMensual = new Chart(
    document.getElementById("graficoMensual"),
    {
      type: "bar",
      data: { labels: meses, datasets: [{ data, backgroundColor: "#4f46e5", borderRadius: 6 }] },
      options: { plugins: { legend: { display: false } } }
    }
  );
}

/* =============================
   ANULAR VENTA
============================= */
window.anularVenta = async id => {
  if (!confirm("¿Anular venta?")) return;

  const ref  = doc(db, "ventas", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const v = snap.data();
  if (v.anulada) return;

  for (const i of v.items) {
    const refP = doc(db, "productos", i.id);
    const p    = await getDoc(refP);
    if (p.exists()) {
      await updateDoc(refP, { stock: p.data().stock + i.cantidad });
    }
  }

  await updateDoc(ref, { anulada: true });
  cargarVentas(); // recarga solo el rango actual
};

/* =============================
   DETALLE VENTA
============================= */
window.verDetalleVenta = id => {
  const venta = ventasGlobal.find(v => v.id === id);
  if (!venta) return;

  let html = "<ul style='text-align:left'>";

  if (venta.items && venta.items.length > 0) {
    venta.items.forEach(item => {
      const subtotal = item.precio_venta * item.cantidad;
      html += `<li>${item.nombre} x${item.cantidad} — $${item.precio_venta} Categoria:${item.categoria}= <b>$${subtotal}</b></li>`;
    });
  } else {
    html += "<li>Sin productos</li>";
  }

  const pagosHTML = pagosDeVenta(venta)
    .map(p => `${(MEDIO_PAGO_INFO[p.medio]?.label || p.medio)}: $${p.monto}`)
    .join("<br>");

  html += `
    </ul>
    <hr>
    Subtotal: $${venta.subtotal || venta.total}<br>
    Descuento: $${venta.descuento || 0}<br>
    <b>Total: $${venta.total}</b>
    <hr>
    ${pagosHTML}
  `;

  Swal.fire({ title: "Detalle de venta", html, width: 600 });
};

/* =============================
   EVENTOS
============================= */
filtroMes.onchange = () => {
  filtroDia.value  = ""; // si elegís mes, limpiás día y año
  filtroAnio.value = "";
  cargarVentas();
};

filtroDia.onchange = () => {
  filtroMes.value  = ""; // si elegís día, limpiás mes y año
  filtroAnio.value = "";
  cargarVentas();
};

filtroAnio.onchange = () => {
  filtroMes.value = ""; // si elegís año, limpiás día y mes
  filtroDia.value = "";
  cargarVentas();
};

/* =============================
   INIT — sin lecturas a Firestore
============================= */
mostrarEstadoVacio();