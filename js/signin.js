import { auth, db } from "./firebase.js";

import { signInWithEmailAndPassword }
from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

import { doc, getDoc }
from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

function initTheme() {
  const html = document.documentElement;
  const icon = document.getElementById('themeIcon');
  const saved = localStorage.getItem('servify-theme') || 'light';
  html.setAttribute('data-theme', saved);
  icon.textContent = saved === 'dark' ? 'light_mode' : 'dark_mode';
  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    icon.textContent = next === 'dark' ? 'light_mode' : 'dark_mode';
    localStorage.setItem('servify-theme', next);
  });
}

function showAlert(msg) {
  const box = document.getElementById('alertBox');
  document.getElementById('alertMessage').textContent = msg;
  box.classList.remove('visible');
  void box.offsetWidth;
  box.classList.add('visible');
}

function hideAlert() {
  document.getElementById('alertBox').classList.remove('visible');
}

function setLoading(on) {
  const btn = document.getElementById('signinBtn');
  document.getElementById('btnText').textContent = on ? 'Signing in...' : 'Sign In';
  document.getElementById('btnSpinner').classList.toggle('visible', on);
  btn.disabled = on;
}

async function handleSignIn() {

  hideAlert();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email) {
    showAlert("Please enter email");
    return;
  }

  if (!password) {
    showAlert("Please enter password");
    return;
  }

  setLoading(true);

  try {

    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const user = userCred.user;

    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      showAlert("Account not found.");
      setLoading(false);
      return;
    }

    const data = docSnap.data();

    if (data.role !== "admin") {
      showAlert("Access denied. Admin only.");
      setLoading(false);
      return;
    }

    localStorage.setItem("servify-admin", "true");

    window.location.href = "index.html";

  } catch (error) {

    setLoading(false);
    showAlert("Login failed: " + error.message);

  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  document.getElementById('signinBtn').addEventListener('click', handleSignIn);
  document.getElementById('email').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('password').focus(); });
  document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') handleSignIn(); });
  document.getElementById('email').addEventListener('input', hideAlert);
  document.getElementById('password').addEventListener('input', hideAlert);
  const pwInput = document.getElementById('password');
  const pwIcon = document.getElementById('pwIcon');
  document.getElementById('togglePw').addEventListener('click', () => {
    const isText = pwInput.type === 'text';
    pwInput.type = isText ? 'password' : 'text';
    pwIcon.textContent = isText ? 'visibility' : 'visibility_off';
  });
  document.getElementById('email').focus();
});