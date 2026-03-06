import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const particleContainer = document.getElementById('particles');

const particleConfigs = [
  { size: 5, top: '30%', left: '22%', dx: '-18px', dy: '-52px', duration: '7s',   delay: '0.3s', opacity: 0.5  },
  { size: 4, top: '45%', left: '15%', dx: '-24px', dy: '-38px', duration: '8.5s', delay: '1.1s', opacity: 0.4  },
  { size: 6, top: '20%', left: '35%', dx: '12px',  dy: '-60px', duration: '6.5s', delay: '0.7s', opacity: 0.45 },
  { size: 3, top: '60%', left: '25%', dx: '-30px', dy: '-28px', duration: '9s',   delay: '1.8s', opacity: 0.35 },
  { size: 5, top: '25%', left: '72%', dx: '22px',  dy: '-55px', duration: '7.5s', delay: '0.5s', opacity: 0.5  },
  { size: 4, top: '50%', left: '80%', dx: '28px',  dy: '-40px', duration: '8s',   delay: '1.4s', opacity: 0.4  },
  { size: 6, top: '35%', left: '68%', dx: '14px',  dy: '-65px', duration: '6s',   delay: '2.0s', opacity: 0.45 },
  { size: 3, top: '65%', left: '75%', dx: '32px',  dy: '-32px', duration: '9.5s', delay: '0.9s', opacity: 0.35 },
  { size: 4, top: '15%', left: '50%', dx: '8px',   dy: '-70px', duration: '7.2s', delay: '1.6s', opacity: 0.42 },
  { size: 5, top: '70%', left: '48%', dx: '-10px', dy: '-50px', duration: '8.2s', delay: '0.2s', opacity: 0.38 },
];

particleConfigs.forEach((cfg) => {
  const el = document.createElement('div');
  el.className = 'particle';
  el.style.cssText = [
    `width:${cfg.size}px`,
    `height:${cfg.size}px`,
    `top:${cfg.top}`,
    `left:${cfg.left}`,
    `--dx:${cfg.dx}`,
    `--dy:${cfg.dy}`,
    `--duration:${cfg.duration}`,
    `--delay:${cfg.delay}`,
    `--max-opacity:${cfg.opacity}`,
  ].join(';');
  particleContainer.appendChild(el);
});

let redirected = false;

function doRedirect(destination) {
  if (redirected) return;
  redirected = true;

  const container = document.querySelector('.splash-container');
  container.classList.add('fade-out');
  document.body.classList.add('fade-out');

  setTimeout(() => {
    window.location.replace(destination);
  }, 580);
}

const minDelay = new Promise(resolve => setTimeout(resolve, 2800));

const authCheck = new Promise(resolve => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { resolve('signin.html'); return; }
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const isAdmin = snap.exists() && snap.data().role === 'admin';
      resolve(isAdmin ? 'index.html' : 'signin.html');
    } catch {
      resolve('signin.html');
    }
  });
});

Promise.all([minDelay, authCheck]).then(([, destination]) => {
  doRedirect(destination);
});