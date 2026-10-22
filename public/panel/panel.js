// Panel de aalcuadrado: inicia sesión, sube fotos y administra las que ya están.
// Habla con la API del mismo dominio (/api). El token vive en sessionStorage:
// se borra al cerrar la pestaña.

const API = '/api';
const CLAVE_TOKEN = 'aalcuadrado.token';

const $ = (selector) => document.querySelector(selector);

const vistas = { login: $('#vista-login'), panel: $('#vista-panel') };
const formLogin = $('#form-login');
const formSubir = $('#form-subir');
const inputArchivos = formSubir.elements.archivos;
const rejilla = $('#rejilla');
const filtro = $('#filtro');
const plantilla = $('#plantilla-foto');

/* ---------- Sesión ---------- */

function leerToken() {
  try {
    return sessionStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

function guardarToken(token) {
  try {
    if (token) sessionStorage.setItem(CLAVE_TOKEN, token);
    else sessionStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Sin almacenamiento: la sesión dura lo que dure la página.
  }
  tokenEnMemoria = token;
}

let tokenEnMemoria = leerToken();

class ErrorApi extends Error {
  constructor(mensaje, estado) {
    super(mensaje);
    this.estado = estado;
  }
}

/** Llama a la API con el token. Si el token venció, regresa al login. */
async function api(ruta, opciones = {}) {
  const headers = new Headers(opciones.headers);
  if (tokenEnMemoria) headers.set('Authorization', `Bearer ${tokenEnMemoria}`);
  if (opciones.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    opciones.body = JSON.stringify(opciones.json);
  }

  const respuesta = await fetch(`${API}${ruta}`, { ...opciones, headers });
  if (respuesta.status === 204) return null;
  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    if (respuesta.status === 401 && ruta !== '/auth/login') {
      cerrarSesion('Tu sesión terminó. Vuelve a entrar.');
    }
    const mensaje = Array.isArray(datos.message) ? datos.message.join('. ') : datos.message;
    throw new ErrorApi(mensaje || `Error ${respuesta.status}`, respuesta.status);
  }
  return datos;
}

function mostrar(vista) {
  vistas.login.hidden = vista !== 'login';
  vistas.panel.hidden = vista !== 'panel';
}

function cerrarSesion(mensaje = '') {
  guardarToken(null);
  rejilla.replaceChildren();
  $('#error-login').textContent = mensaje;
  mostrar('login');
  formLogin.elements.usuario.focus();
}

async function entrarAlPanel() {
  const yo = await api('/usuarios/yo');
  $('#nombre-usuario').textContent = yo.usuario;
  mostrar('panel');
  await cargarFotos();
}

formLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const boton = formLogin.querySelector('button');
  const error = $('#error-login');
  error.textContent = '';
  boton.disabled = true;
  try {
    const { access_token } = await api('/auth/login', {
      method: 'POST',
      json: { usuario: formLogin.elements.usuario.value.trim(), password: formLogin.elements.password.value },
    });
    guardarToken(access_token);
    formLogin.reset();
    await entrarAlPanel();
  } catch (e) {
    error.textContent = e.estado === 429 ? 'Demasiados intentos. Espera un minuto.' : e.message;
  } finally {
    boton.disabled = false;
  }
});

$('#boton-salir').addEventListener('click', () => cerrarSesion());

/* ---------- Avisos ---------- */

let temporizadorAviso;
function avisar(texto) {
  const aviso = $('#aviso');
  aviso.textContent = texto;
  aviso.classList.add('aviso--visible');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => aviso.classList.remove('aviso--visible'), 2500);
}

/* ---------- Subir ---------- */

const zona = $('#zona');
for (const tipo of ['dragenter', 'dragover']) {
  zona.addEventListener(tipo, () => zona.classList.add('zona--encima'));
}
for (const tipo of ['dragleave', 'drop']) {
  zona.addEventListener(tipo, () => zona.classList.remove('zona--encima'));
}

let urlsPrevias = [];
function mostrarPrevias() {
  urlsPrevias.forEach((url) => URL.revokeObjectURL(url));
  urlsPrevias = [...inputArchivos.files].map((archivo) => URL.createObjectURL(archivo));
  $('#previas').replaceChildren(
    ...urlsPrevias.map((url) => {
      const li = document.createElement('li');
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      li.append(img);
      return li;
    }),
  );
}
inputArchivos.addEventListener('change', mostrarPrevias);

formSubir.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const error = $('#error-subir');
  const boton = $('#boton-subir');
  error.textContent = '';

  if (inputArchivos.files.length > 10) {
    error.textContent = 'Sube como máximo 10 fotos por vez.';
    return;
  }

  const datos = new FormData(formSubir);
  boton.disabled = true;
  boton.textContent = 'Subiendo…';
  try {
    const subidas = await api('/imagenes', { method: 'POST', body: datos });
    avisar(subidas.length === 1 ? 'Foto subida' : `${subidas.length} fotos subidas`);
    const categoria = formSubir.elements.categoria.value;
    formSubir.reset();
    formSubir.elements.categoria.value = categoria;
    mostrarPrevias();
    await cargarFotos();
  } catch (e) {
    error.textContent = e.estado === 413 ? 'Una de las fotos pesa demasiado.' : e.message;
  } finally {
    boton.disabled = false;
    boton.textContent = 'Subir';
  }
});

/* ---------- Listado ---------- */

function formatoTamano(bytes) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function pintarFoto(imagen) {
  const nodo = plantilla.content.firstElementChild.cloneNode(true);
  const enlace = nodo.querySelector('.foto__imagen');
  const img = nodo.querySelector('img');
  enlace.href = imagen.url;
  img.src = imagen.url;
  img.alt = imagen.alt ?? '';

  const meta = nodo.querySelector('.foto__meta');
  const titulo = document.createElement('strong');
  titulo.textContent = imagen.producto ?? (imagen.categoria === 'galeria' ? 'Galería' : 'Sin producto');
  const detalle = [imagen.color, `orden ${imagen.orden}`, formatoTamano(imagen.tamanoBytes)].filter(Boolean);
  meta.append(titulo, ` · ${detalle.join(' · ')}`);

  const alt = nodo.querySelector('.foto__alt');
  alt.value = imagen.alt ?? '';
  alt.addEventListener('change', async () => {
    try {
      await api(`/imagenes/${imagen.id}`, { method: 'PATCH', json: { alt: alt.value.trim() } });
      avisar('Texto guardado');
    } catch (e) {
      avisar(e.message);
    }
  });

  nodo.querySelector('[data-accion="copiar"]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(imagen.url);
      avisar('URL copiada');
    } catch {
      window.prompt('Copia la URL:', imagen.url);
    }
  });

  nodo.querySelector('[data-accion="borrar"]').addEventListener('click', async () => {
    if (!window.confirm(`¿Borrar "${imagen.nombreOriginal}"? No se puede deshacer.`)) return;
    try {
      await api(`/imagenes/${imagen.id}`, { method: 'DELETE' });
      nodo.remove();
      actualizarTotal(rejilla.children.length);
      avisar('Foto borrada');
    } catch (e) {
      avisar(e.message);
    }
  });

  return nodo;
}

function actualizarTotal(total) {
  $('#total').textContent = `(${total})`;
  $('#vacio').hidden = total > 0;
}

async function cargarFotos() {
  const parametros = filtro.value ? `?categoria=${encodeURIComponent(filtro.value)}` : '';
  const imagenes = await api(`/imagenes${parametros}`);
  rejilla.replaceChildren(...imagenes.map(pintarFoto));
  actualizarTotal(imagenes.length);
}

filtro.addEventListener('change', () => cargarFotos().catch((e) => avisar(e.message)));

/* ---------- Inicio ---------- */

if (tokenEnMemoria) {
  entrarAlPanel().catch(() => cerrarSesion());
} else {
  mostrar('login');
}
