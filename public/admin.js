import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById("form");
const lista = document.getElementById("lista");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const producto = {
    nombre: form.nombre.value,
    categoria: form.categoria.value,
    precio: Number(form.precio.value),
    stock: Number(form.stock.value)
  };

  await addDoc(collection(db, "productos"), producto);

  form.reset();
  cargar();
});

async function cargar() {
  lista.innerHTML = "";
  const snapshot = await getDocs(collection(db, "productos"));

  snapshot.forEach((doc) => {
    const p = doc.data();
    lista.innerHTML += `
      <div>
        ${p.nombre} | ${p.categoria} | $${p.precio} | stock: ${p.stock}
      </div>
    `;
  });
}

cargar();
