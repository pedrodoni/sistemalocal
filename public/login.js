import { getAuth, signInWithEmailAndPassword } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { app } from "./firebase.js";

const auth = getAuth(app);

document.getElementById("btnLogin").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;
  const error = document.getElementById("error");

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    window.location.href = "index.html";
  } catch (e) {
    error.textContent = "Email o contraseña incorrectos";
  }
});
