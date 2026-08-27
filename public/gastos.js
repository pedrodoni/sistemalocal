import { auth, db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* =============================
   AUTH
============================= */
onAuthStateChanged(auth, user => {
  if (!user) window.location.href = "login.html";
});

const Swal = window.Swal;

/* =============================
   REFS
============================= */
const gastosRef = collection(db, "gastos");

const mesNombreSpan = document.getElementById("mesNombre");
const anioNombreSpan = document.getElementById("anioNombre");
const btnMesAnterior = document.getElementById("mesAnterior");
const btnMesSiguiente = document.getElementById("mesSiguiente");
const btnMesActual = document.getElementById("mesActual");
const mesGrid = document.getElementById("mesGrid");

const totalMesSpan = document.getElementById("totalMes");
const cantidadGastosSpan = document.getElementById("cantidadGastos");
const promedioDiarioSpan = document.getElementById("promedioDiario");
const comparativaMesSpan = document.getElementById("comparativaMes");
const desgloseCategorias = document.getElementById("desgloseCategorias");

const conceptoInput = document.getElementById("concepto");
const categoriaSelect = document.getElementById("categoria");
const categoriaOtroInput = document.getElementById("categoriaOtro");
const montoInput = document.getElementById("monto");
const diaSelect = document.getElementById("dia");
const btnGuardar = document.getElementById("guardar");

const lista = document.getElementById("lista");

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const hoy = new Date();
let anioSeleccionado = hoy.getFullYear();
let mesSeleccionado = hoy.getMonth() + 1; // 1-12

let gastosCache = null; // se pide una sola vez y se reutiliza en memoria

/* =============================
   CARGAR GASTOS (una sola vez)
============================= */
async function cargarGastos() {
  if (gastosCache) return gastosCache;

  const snap = await getDocs(gastosRef);
  gastosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return gastosCache;
}

function diasEnMes(mes, anio) {
  return new Date(anio, mes, 0).getDate();
}

/* =============================
   SELECTOR DE MES
============================= */
function renderSelectorMes() {
  mesNombreSpan.textContent = MESES[mesSeleccionado - 1];
  anioNombreSpan.textContent = anioSeleccionado;
}

function renderMesGrid() {
  mesGrid.innerHTML = "";

  MESES.forEach((nombre, i) => {
    const mes = i + 1;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mes-grid-item";
    btn.textContent = nombre.slice(0, 3);

    if (mes === mesSeleccionado) btn.classList.add("activo");

    btn.onclick = () => {
      mesSeleccionado = mes;
      mesGrid.style.display = "none";
      actualizarTodo();
    };

    mesGrid.appendChild(btn);
  });

  const navAnio = document.createElement("div");
  navAnio.className = "mes-grid-nav-anio";
  navAnio.innerHTML = `
    <button type="button" id="anioAnteriorGrid">‹</button>
    <span>${anioSeleccionado}</span>
    <button type="button" id="anioSiguienteGrid">›</button>
  `;
  mesGrid.prepend(navAnio);

  document.getElementById("anioAnteriorGrid").onclick = () => {
    anioSeleccionado--;
    renderMesGrid();
  };
  document.getElementById("anioSiguienteGrid").onclick = () => {
    anioSeleccionado++;
    renderMesGrid();
  };
}

btnMesActual.onclick = () => {
  const visible = mesGrid.style.display !== "none";
  if (visible) {
    mesGrid.style.display = "none";
  } else {
    renderMesGrid();
    mesGrid.style.display = "grid";
  }
};

btnMesAnterior.onclick = () => {
  mesSeleccionado--;
  if (mesSeleccionado < 1) {
    mesSeleccionado = 12;
    anioSeleccionado--;
  }
  actualizarTodo();
};

btnMesSiguiente.onclick = () => {
  mesSeleccionado++;
  if (mesSeleccionado > 12) {
    mesSeleccionado = 1;
    anioSeleccionado++;
  }
  actualizarTodo();
};

/* =============================
   SELECT DE DÍA
============================= */
function renderDiaSelect() {
  const total = diasEnMes(mesSeleccionado, anioSeleccionado);
  const esMesActual =
    mesSeleccionado === hoy.getMonth() + 1 && anioSeleccionado === hoy.getFullYear();
  const diaPorDefecto = esMesActual ? hoy.getDate() : total;

  diaSelect.innerHTML = "";
  for (let d = 1; d <= total; d++) {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = `Día ${d}`;
    if (d === diaPorDefecto) opt.selected = true;
    diaSelect.appendChild(opt);
  }
}

/* =============================
   CATEGORÍA "OTRO"
============================= */
categoriaSelect.onchange = () => {
  categoriaOtroInput.style.display = categoriaSelect.value === "Otro" ? "block" : "none";
};

/* =============================
   RESUMEN + LISTA
============================= */
function gastosDelMes(mes, anio) {
  return (gastosCache || []).filter(g => g.mes === mes && g.anio === anio);
}

function renderResumen() {
  const delMes = gastosDelMes(mesSeleccionado, anioSeleccionado);
  const total = delMes.reduce((acc, g) => acc + g.monto, 0);

  totalMesSpan.textContent = "$" + total.toLocaleString("es-AR");
  cantidadGastosSpan.textContent = delMes.length;

  const diasDelMes = diasEnMes(mesSeleccionado, anioSeleccionado);
  const esMesActual =
    mesSeleccionado === hoy.getMonth() + 1 && anioSeleccionado === hoy.getFullYear();
  const diasTranscurridos = esMesActual ? hoy.getDate() : diasDelMes;
  const promedio = diasTranscurridos > 0 ? total / diasTranscurridos : 0;

  promedioDiarioSpan.textContent = "$" + Math.round(promedio).toLocaleString("es-AR");

  // Comparativa vs mes anterior
  let mesAnt = mesSeleccionado - 1;
  let anioAnt = anioSeleccionado;
  if (mesAnt < 1) { mesAnt = 12; anioAnt--; }

  const totalAnterior = gastosDelMes(mesAnt, anioAnt).reduce((acc, g) => acc + g.monto, 0);

  if (totalAnterior === 0) {
    comparativaMesSpan.textContent = "—";
    comparativaMesSpan.style.color = "#666";
  } else {
    const variacion = ((total - totalAnterior) / totalAnterior) * 100;
    const flecha = variacion >= 0 ? "▲" : "▼";
    comparativaMesSpan.textContent = `${flecha} ${Math.abs(variacion).toFixed(1)}%`;
    comparativaMesSpan.style.color = variacion > 0 ? "#c0392b" : "#1f8f3a";
  }

  // Desglose por categoría
  const porCategoria = {};
  delMes.forEach(g => {
    const cat = g.categoria || "Otro";
    porCategoria[cat] = (porCategoria[cat] || 0) + g.monto;
  });

  desgloseCategorias.innerHTML = "";

  if (Object.keys(porCategoria).length === 0) {
    desgloseCategorias.innerHTML = `<p style="color:#888; margin:10px 0 0;">Sin gastos cargados este mes.</p>`;
  } else {
    Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, monto]) => {
        const pct = total > 0 ? (monto / total) * 100 : 0;

        const fila = document.createElement("div");
        fila.className = "categoria-fila";
        fila.innerHTML = `
          <div class="categoria-fila-top">
            <span>${cat}</span>
            <span>$${monto.toLocaleString("es-AR")}</span>
          </div>
          <div class="categoria-barra-fondo">
            <div class="categoria-barra" style="width:${pct}%;"></div>
          </div>
        `;
        desgloseCategorias.appendChild(fila);
      });
  }
}

function renderLista() {
  lista.innerHTML = "";

  const delMes = gastosDelMes(mesSeleccionado, anioSeleccionado)
    .sort((a, b) => a.dia - b.dia);

  if (delMes.length === 0) {
    lista.innerHTML = `<li style="color:#888; padding:12px;">Sin gastos cargados en ${MESES[mesSeleccionado - 1]} ${anioSeleccionado}.</li>`;
    return;
  }

  delMes.forEach(g => {
    const li = document.createElement("li");
    li.className = "gasto-item";

    const fechaLabel = `${String(g.dia).padStart(2, "0")}/${String(g.mes).padStart(2, "0")}`;

    li.innerHTML = `
      <div class="gasto-info">
        <span class="gasto-fecha">${fechaLabel}</span>
        <span class="gasto-concepto">${g.concepto}</span>
        <span class="gasto-categoria">${g.categoria}</span>
      </div>
      <div class="gasto-derecha">
        <span class="gasto-monto">$${g.monto.toLocaleString("es-AR")}</span>
        <button data-id="${g.id}" class="gasto-borrar">❌</button>
      </div>
    `;

    li.querySelector(".gasto-borrar").onclick = () => eliminarGasto(g.id);

    lista.appendChild(li);
  });
}

function actualizarTodo() {
  renderSelectorMes();
  renderDiaSelect();
  renderResumen();
  renderLista();
}

/* =============================
   GUARDAR GASTO
============================= */
btnGuardar.onclick = async () => {
  const concepto = conceptoInput.value.trim();
  const categoria = categoriaSelect.value === "Otro"
    ? categoriaOtroInput.value.trim()
    : categoriaSelect.value;
  const monto = Number(montoInput.value);
  const dia = Number(diaSelect.value);

  if (!concepto || !categoria || !monto || monto <= 0 || !dia) {
    Swal.fire("Datos inválidos", "Completá concepto, categoría y monto.", "warning");
    return;
  }

  const nuevoGasto = {
    concepto,
    categoria,
    monto,
    anio: anioSeleccionado,
    mes: mesSeleccionado,
    dia,
    creado: serverTimestamp()
  };

  const ref = await addDoc(gastosRef, nuevoGasto);
  gastosCache.push({ id: ref.id, ...nuevoGasto, creado: new Date() });

  conceptoInput.value = "";
  montoInput.value = "";
  categoriaSelect.value = "Alquiler";
  categoriaOtroInput.value = "";
  categoriaOtroInput.style.display = "none";

  renderResumen();
  renderLista();

  Swal.fire({ icon: "success", title: "Gasto agregado", timer: 1200, showConfirmButton: false });
};

/* =============================
   ELIMINAR GASTO
============================= */
async function eliminarGasto(id) {
  const confirmar = await Swal.fire({
    title: "¿Eliminar gasto?",
    showCancelButton: true,
    confirmButtonText: "Eliminar",
    cancelButtonText: "Cancelar",
    icon: "warning"
  });

  if (!confirmar.isConfirmed) return;

  await deleteDoc(doc(db, "gastos", id));
  gastosCache = gastosCache.filter(g => g.id !== id);

  renderResumen();
  renderLista();
}

/* =============================
   INIT
============================= */
async function init() {
  await cargarGastos();
  actualizarTodo();
}

init();
