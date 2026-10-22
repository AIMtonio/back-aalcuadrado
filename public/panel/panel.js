// Panel de aalcuadrado: inicia sesión, administra productos y sube fotos.
// Habla con la API del mismo dominio (/api). El token vive en sessionStorage:
// se borra al cerrar la pestaña.

const API = '/api';
const CLAVE_TOKEN = 'aalcuadrado.token';
const CLAVE_PESTANA = 'aalcuadrado.pestana';

/** Los mismos nombres que muestra el front (src/domain/colecciones.ts). */
const NOMBRES_COLECCION = {
  'dia-de-muertos': 'Día de Muertos',
  mexicanos: 'Mexicanos',
  patrios: 'Patrios',
  navidad: 'Navidad',
  otros: 'Otros',
};

const $ = (selector, raiz = document) => raiz.querySelector(selector);

const vistas = { login: $('#vista-login'), panel: $('#vista-panel') };
const formLogin = $('#form-login');
const formSubir = $('#form-subir');
const formEditar = $('#form-editar');
const formProducto = $('#form-producto');
const dialogoEditar = $('#dialogo-editar');
const dialogoProducto = $('#dialogo-producto');
const inputArchivos = formSubir.elements.archivos;
const rejilla = $('#rejilla');
const rejillaProductos = $('#rejilla-productos');
const filtro = $('#filtro');

/* ---------- Almacenamiento (puede no estar disponible) ---------- */

function leer(clave) {
  try {
    return sessionStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave, valor) {
  try {
    if (valor === null) sessionStorage.removeItem(clave);
    else sessionStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento: dura lo que dure la página.
  }
}

/* ---------- Sesión ---------- */

let token = leer(CLAVE_TOKEN);

class ErrorApi extends Error {
  constructor(mensaje, estado) {
    super(mensaje);
    this.estado = estado;
  }
}

/** Llama a la API con el token. Si el token venció, regresa al login. */
async function api(ruta, opciones = {}) {
  const headers = new Headers(opciones.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
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
  token = null;
  escribir(CLAVE_TOKEN, null);
  rejilla.replaceChildren();
  rejillaProductos.replaceChildren();
  for (const dialogo of [dialogoEditar, dialogoProducto]) if (dialogo.open) dialogo.close();
  $('#error-login').textContent = mensaje;
  mostrar('login');
  formLogin.elements.usuario.focus();
}

async function entrarAlPanel() {
  const yo = await api('/usuarios/yo');
  $('#nombre-usuario').textContent = yo.usuario;
  mostrar('panel');
  cambiarPestana(leer(CLAVE_PESTANA) ?? 'fotos');
  await cargarCatalogo();
  await cargarFotos();
  await cargarPublicacion();
}

formLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const boton = formLogin.querySelector('button');
  const error = $('#error-login');
  error.textContent = '';
  boton.disabled = true;
  try {
    const respuesta = await api('/auth/login', {
      method: 'POST',
      json: { usuario: formLogin.elements.usuario.value.trim(), password: formLogin.elements.password.value },
    });
    token = respuesta.access_token;
    escribir(CLAVE_TOKEN, token);
    formLogin.reset();
    await entrarAlPanel();
  } catch (e) {
    error.textContent = e.estado === 429 ? 'Demasiados intentos. Espera un minuto.' : e.message;
  } finally {
    boton.disabled = false;
  }
});

$('#boton-salir').addEventListener('click', () => cerrarSesion());

/* ---------- Pestañas ---------- */

function cambiarPestana(nombre) {
  for (const boton of document.querySelectorAll('[data-pestana]')) {
    const activa = boton.dataset.pestana === nombre;
    if (activa) boton.setAttribute('aria-current', 'page');
    else boton.removeAttribute('aria-current');
  }
  $('#pestana-fotos').hidden = nombre !== 'fotos';
  $('#pestana-productos').hidden = nombre !== 'productos';
  escribir(CLAVE_PESTANA, nombre);
}

for (const boton of document.querySelectorAll('[data-pestana]')) {
  boton.addEventListener('click', () => cambiarPestana(boton.dataset.pestana));
}

/* ---------- Publicar el sitio ---------- */

let ultimaPublicacion = null;

function haceCuanto(fechaIso) {
  const minutos = Math.round((Date.now() - new Date(fechaIso).getTime()) / 60_000);
  if (minutos < 1) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  return horas < 24 ? `hace ${horas} h` : new Date(fechaIso).toLocaleString('es-MX');
}

function pintarPublicacion() {
  $('#estado-publicacion').textContent = ultimaPublicacion
    ? `Publicado ${haceCuanto(ultimaPublicacion.solicitadaEn)}`
    : '';
}

/** Muestra el botón solo si la API tiene DEPLOY_HOOK_URL. */
async function cargarPublicacion() {
  try {
    const estado = await api('/publicacion');
    $('#publicar').hidden = !estado.configurada;
    ultimaPublicacion = estado.ultima;
    pintarPublicacion();
  } catch {
    $('#publicar').hidden = true;
  }
}

$('#boton-publicar').addEventListener('click', async () => {
  if (
    !window.confirm(
      'Se volverá a compilar el sitio con los productos y fotos que hay ahora en el panel. ¿Publicar?',
    )
  ) {
    return;
  }
  const boton = $('#boton-publicar');
  boton.disabled = true;
  boton.textContent = 'Publicando…';
  try {
    ultimaPublicacion = await api('/publicacion', { method: 'POST' });
    pintarPublicacion();
    avisar('Publicando: el sitio se actualiza en 1 a 2 minutos');
  } catch (e) {
    avisar(e.estado === 429 ? 'Espera un minuto antes de volver a publicar.' : e.message);
  } finally {
    boton.disabled = false;
    boton.textContent = 'Publicar sitio';
  }
});

// Mantiene al día el "hace X min".
setInterval(() => {
  if (!$('#publicar').hidden) pintarPublicacion();
}, 60_000);

/* ---------- Avisos ---------- */

let temporizadorAviso;
function avisar(texto) {
  const aviso = $('#aviso');
  aviso.textContent = texto;
  aviso.classList.add('aviso--visible');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => aviso.classList.remove('aviso--visible'), 2800);
}

/* ---------- Utilidades ---------- */

/** "Rosa mexicano" → `rosa-mexicano`. Igual que `slugificar` del front y de la API. */
function slugificar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function opcion(valor, texto) {
  const o = document.createElement('option');
  o.value = valor;
  o.textContent = texto;
  return o;
}

function muestraDeColor(hex, titulo) {
  const muestra = document.createElement('span');
  muestra.className = 'muestra';
  muestra.style.background = hex;
  if (titulo) muestra.title = titulo;
  return muestra;
}

/* ---------- Catálogo (productos de la API) ---------- */

/** Productos con sus colores, tal como los devuelve `GET /api/productos`. */
let catalogo = [];

async function cargarCatalogo() {
  catalogo = await api('/productos');
  $('#estado-catalogo').textContent =
    catalogo.length === 0 ? 'Crea un producto en la pestaña Productos para poder subir sus fotos.' : '';
  for (const form of formulariosDeFoto) llenarProductos(form);
  pintarProductos();
}

const buscarProducto = (slug) => catalogo.find((p) => p.slug === slug);

/* ---------- Productos ---------- */

function pintarProductos() {
  const plantilla = $('#plantilla-producto');
  rejillaProductos.replaceChildren(
    ...catalogo.map((producto) => {
      const nodo = plantilla.content.firstElementChild.cloneNode(true);
      nodo.classList.toggle('producto--agotado', !producto.disponible);
      $('.producto__nombre', nodo).textContent = producto.nombre;
      $('.producto__coleccion', nodo).textContent = NOMBRES_COLECCION[producto.coleccion] ?? producto.coleccion;

      const colores = $('.producto__colores', nodo);
      for (const color of producto.colores) {
        const li = document.createElement('li');
        li.append(muestraDeColor(color.hex), color.nombre);
        colores.append(li);
      }
      if (producto.colores.length === 0) colores.hidden = true;

      $('.producto__descripcion', nodo).textContent = producto.descripcion || 'Sin descripción';
      $('.producto__descripcion', nodo).classList.toggle('foto__alt--vacio', !producto.descripcion);

      const insignias = [
        `${producto.totalFotos} ${producto.totalFotos === 1 ? 'foto' : 'fotos'}`,
        !producto.disponible && 'Agotado',
        producto.destacado && 'Destacado',
        producto.etiqueta,
        producto.orden !== null && `orden ${producto.orden}`,
      ].filter(Boolean);
      $('.producto__insignias', nodo).replaceChildren(
        ...insignias.map((texto) => {
          const span = document.createElement('span');
          span.className = 'insignia';
          if (texto === 'Agotado' || (texto.endsWith('fotos') && producto.totalFotos === 0)) {
            span.classList.add('insignia--alerta');
          }
          span.textContent = texto;
          return span;
        }),
      );

      $('[data-accion="editar"]', nodo).addEventListener('click', () => abrirProducto(producto));
      $('[data-accion="fotos"]', nodo).addEventListener('click', () => subirFotosDe(producto));
      $('[data-accion="borrar"]', nodo).addEventListener('click', () => borrarProducto(producto));
      return nodo;
    }),
  );
  $('#total-productos').textContent = `(${catalogo.length})`;
  $('#vacio-productos').hidden = catalogo.length > 0;
}

/** Lleva a "Fotos" con el producto ya elegido. */
function subirFotosDe(producto) {
  cambiarPestana('fotos');
  formSubir.elements.categoria.value = 'productos';
  llenarProductos(formSubir, producto.slug);
  llenarColores(formSubir, '');
  actualizarCampos(formSubir);
  filtro.value = '';
  cargarFotos().catch((e) => avisar(e.message));
  $('#zona').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function borrarProducto(producto) {
  if (producto.totalFotos > 0) {
    avisar(`Primero borra o mueve sus ${producto.totalFotos} foto(s).`);
    return;
  }
  if (!window.confirm(`¿Borrar "${producto.nombre}"? No se puede deshacer.`)) return;
  try {
    await api(`/productos/${encodeURIComponent(producto.slug)}`, { method: 'DELETE' });
    avisar('Producto borrado');
    await cargarCatalogo();
  } catch (e) {
    avisar(e.message);
  }
}

/* ---------- Diálogo de producto ---------- */

let productoEditando = null;
let slugTocado = false;
const listaColores = $('#lista-colores');

function agregarFilaColor(color = { nombre: '', hex: '#3B2A9B' }) {
  const fila = $('#plantilla-color').content.firstElementChild.cloneNode(true);
  const hex = $('[data-campo="hex"]', fila);
  const nombre = $('[data-campo="nombre"]', fila);
  const id = $('.color-fila__id', fila);
  hex.value = color.hex.length === 4 ? `#${[...color.hex.slice(1)].map((c) => c + c).join('')}` : color.hex;
  nombre.value = color.nombre;
  // Un color existente conserva su id aunque cambie el nombre: las fotos lo usan.
  fila.dataset.id = color.id ?? '';
  const pintarId = () => {
    id.textContent = fila.dataset.id || slugificar(nombre.value) || '—';
  };
  nombre.addEventListener('input', pintarId);
  pintarId();
  $('[data-accion="quitar"]', fila).addEventListener('click', () => fila.remove());
  listaColores.append(fila);
  return nombre;
}

$('#boton-agregar-color').addEventListener('click', () => agregarFilaColor().focus());

function contarDescripcion() {
  $('#contador-descripcion').textContent = `${formProducto.elements.descripcion.value.length}/240`;
}
formProducto.elements.descripcion.addEventListener('input', contarDescripcion);

formProducto.elements.nombre.addEventListener('input', () => {
  if (!productoEditando && !slugTocado) formProducto.elements.slug.value = slugificar(formProducto.elements.nombre.value);
});
formProducto.elements.slug.addEventListener('input', () => {
  slugTocado = true;
});

$('#boton-nuevo-producto').addEventListener('click', () => abrirProducto(null));

function abrirProducto(producto) {
  productoEditando = producto;
  slugTocado = false;
  formProducto.reset();
  $('#error-producto').textContent = '';
  $('#titulo-producto').textContent = producto ? `Editar ${producto.nombre}` : 'Nuevo producto';
  const campos = formProducto.elements;
  campos.slug.disabled = Boolean(producto);
  listaColores.replaceChildren();
  if (producto) {
    campos.nombre.value = producto.nombre;
    campos.slug.value = producto.slug;
    campos.coleccion.value = producto.coleccion;
    campos.etiqueta.value = producto.etiqueta ?? '';
    campos.descripcion.value = producto.descripcion;
    campos.orden.value = producto.orden ?? '';
    campos.precio.value = producto.precio ?? '';
    campos.disponible.checked = producto.disponible;
    campos.destacado.checked = producto.destacado;
    producto.colores.forEach((c) => agregarFilaColor(c));
  } else {
    agregarFilaColor();
  }
  contarDescripcion();
  dialogoProducto.showModal();
  campos.nombre.focus();
}

function datosDelProducto() {
  const campos = formProducto.elements;
  const numero = (valor) => (valor === '' ? null : Number(valor));
  const colores = [...listaColores.children]
    .map((fila) => ({
      id: fila.dataset.id || undefined,
      nombre: $('[data-campo="nombre"]', fila).value.trim(),
      hex: $('[data-campo="hex"]', fila).value.toUpperCase(),
    }))
    // Una fila nueva sin nombre se ignora.
    .filter((c) => c.nombre || c.id);
  return {
    ...(productoEditando ? {} : { slug: campos.slug.value.trim() || undefined }),
    nombre: campos.nombre.value.trim(),
    coleccion: campos.coleccion.value,
    etiqueta: campos.etiqueta.value || null,
    descripcion: campos.descripcion.value.trim(),
    orden: numero(campos.orden.value),
    precio: numero(campos.precio.value),
    disponible: campos.disponible.checked,
    destacado: campos.destacado.checked,
    colores,
  };
}

for (const boton of dialogoProducto.querySelectorAll('[data-cerrar]')) {
  boton.addEventListener('click', () => dialogoProducto.close());
}

formProducto.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const error = $('#error-producto');
  error.textContent = '';
  if (!formProducto.reportValidity()) return;

  const datos = datosDelProducto();
  // Avisar antes de guardar si se quita un color que tiene fotos.
  if (productoEditando?.totalFotos) {
    const quitados = productoEditando.colores.filter((c) => !datos.colores.some((n) => n.id === c.id));
    if (
      quitados.length > 0 &&
      !window.confirm(
        `Quitaste ${quitados.map((c) => c.nombre).join(', ')}. Las fotos de ese color se quedarán sin color. ¿Seguir?`,
      )
    ) {
      return;
    }
  }

  const boton = $('#boton-guardar-producto');
  boton.disabled = true;
  try {
    const guardado = productoEditando
      ? await api(`/productos/${encodeURIComponent(productoEditando.slug)}`, { method: 'PATCH', json: datos })
      : await api('/productos', { method: 'POST', json: datos });
    dialogoProducto.close();
    avisar(productoEditando ? 'Producto guardado' : `"${guardado.nombre}" creado`);
    await cargarCatalogo();
    await cargarFotos();
  } catch (e) {
    error.textContent = e.message;
  } finally {
    boton.disabled = false;
  }
});

/* ---------- Campos de una foto (subir y editar) ---------- */

const contenedoresCampos = [...document.querySelectorAll('[data-asignacion]')];
const formulariosDeFoto = contenedoresCampos.map((contenedor) => {
  contenedor.append($('#plantilla-campos').content.cloneNode(true));
  const form = contenedor.closest('form');
  form.elements.categoria.addEventListener('change', () => actualizarCampos(form));
  form.elements.producto.addEventListener('change', () => {
    llenarColores(form, '');
    sugerirAlt(form);
  });
  form.elements.color.addEventListener('change', () => sugerirAlt(form));
  return form;
});

function llenarProductos(form, valor = form.elements.producto.value) {
  const campo = form.elements.producto;
  campo.replaceChildren(opcion('', 'Elige un producto…'), ...catalogo.map((p) => opcion(p.slug, p.nombre)));
  // Una foto con un producto que ya no existe conserva su valor, marcado.
  if (valor && !buscarProducto(valor)) campo.append(opcion(valor, `${valor} (no existe)`));
  campo.value = valor;
  llenarColores(form);
}

function llenarColores(form, valor = form.elements.color.value) {
  const campo = form.elements.color;
  const producto = buscarProducto(form.elements.producto.value);
  campo.replaceChildren(
    opcion('', 'Sin color en particular'),
    ...(producto?.colores ?? []).map((c) => opcion(c.id, c.nombre)),
  );
  if (valor && !producto?.colores.some((c) => c.id === valor)) {
    campo.append(opcion(valor, `${valor} (no existe en este producto)`));
  }
  campo.value = valor;
}

/** La galería no lleva producto ni color. */
function actualizarCampos(form) {
  const esProducto = form.elements.categoria.value === 'productos';
  for (const etiqueta of form.querySelectorAll('[data-solo-productos]')) {
    etiqueta.hidden = !esProducto;
    for (const campo of etiqueta.querySelectorAll('select, input')) campo.disabled = !esProducto;
  }
  form.elements.producto.required = esProducto;
  sugerirAlt(form);
}

/** Muestra como ejemplo el texto que el sitio usa cuando el alternativo se deja vacío. */
function sugerirAlt(form) {
  const producto = buscarProducto(form.elements.producto.value);
  const color = producto?.colores.find((c) => c.id === form.elements.color.value);
  form.elements.alt.placeholder =
    form.elements.categoria.value === 'galeria'
      ? 'Aretes en su caja, sobre la mesa'
      : producto
        ? [`Aretes ${producto.nombre}`, color && `en color ${color.nombre.toLowerCase()}`].filter(Boolean).join(', ')
        : 'Aretes Nochebuena, en color rojo';
}

/** Los campos de producto y color deshabilitados no viajan; se mandan vacíos para que la API los limpie. */
function datosDe(form) {
  const esProducto = form.elements.categoria.value === 'productos';
  return {
    categoria: form.elements.categoria.value,
    producto: esProducto ? form.elements.producto.value : '',
    color: esProducto ? form.elements.color.value : '',
    orden: Number(form.elements.orden.value || 0),
    alt: form.elements.alt.value.trim(),
  };
}

for (const form of formulariosDeFoto) actualizarCampos(form);

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

  const datos = new FormData();
  for (const archivo of inputArchivos.files) datos.append('archivos', archivo);
  for (const [campo, valor] of Object.entries(datosDe(formSubir))) {
    if (valor !== '') datos.append(campo, String(valor));
  }

  boton.disabled = true;
  boton.textContent = 'Subiendo…';
  try {
    const subidas = await api('/imagenes', { method: 'POST', body: datos });
    avisar(subidas.length === 1 ? 'Foto subida' : `${subidas.length} fotos subidas`);
    // Se conservan categoría, producto y color para subir otra tanda del mismo producto.
    inputArchivos.value = '';
    formSubir.elements.alt.value = '';
    mostrarPrevias();
    await Promise.all([cargarFotos(), cargarCatalogo()]);
  } catch (e) {
    error.textContent = e.estado === 413 ? 'Una de las fotos pesa demasiado.' : e.message;
  } finally {
    boton.disabled = false;
    boton.textContent = 'Subir';
  }
});

/* ---------- Editar foto ---------- */

let fotoEditando = null;

function abrirEdicion(imagen) {
  fotoEditando = imagen;
  $('#error-editar').textContent = '';
  $('#imagen-editar').src = imagen.url;
  const campos = formEditar.elements;
  campos.categoria.value = imagen.categoria;
  // Primero el producto (de él dependen los colores) y luego el color.
  llenarProductos(formEditar, imagen.producto ?? '');
  llenarColores(formEditar, imagen.color ?? '');
  campos.orden.value = imagen.orden;
  campos.alt.value = imagen.alt ?? '';
  actualizarCampos(formEditar);
  dialogoEditar.showModal();
}

for (const boton of dialogoEditar.querySelectorAll('[data-cerrar]')) {
  boton.addEventListener('click', () => dialogoEditar.close());
}

formEditar.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (!fotoEditando) return;
  const boton = $('#boton-guardar');
  boton.disabled = true;
  try {
    await api(`/imagenes/${fotoEditando.id}`, { method: 'PATCH', json: datosDe(formEditar) });
    dialogoEditar.close();
    avisar('Cambios guardados');
    await Promise.all([cargarFotos(), cargarCatalogo()]);
  } catch (e) {
    $('#error-editar').textContent = e.message;
  } finally {
    boton.disabled = false;
  }
});

/* ---------- Listado de fotos ---------- */

/** Por qué una foto no se verá en el sitio, o `null` si está bien. */
function problemaDe(imagen) {
  if (imagen.categoria !== 'productos') return null;
  if (!imagen.producto) return 'Sin producto: no se verá en el sitio.';
  if (!buscarProducto(imagen.producto)) return `"${imagen.producto}" no existe: no se verá.`;
  return null;
}

function pintarFoto(imagen) {
  const nodo = $('#plantilla-foto').content.firstElementChild.cloneNode(true);
  $('.foto__imagen', nodo).href = imagen.url;
  const img = $('img', nodo);
  img.src = imagen.url;
  img.alt = imagen.alt ?? '';

  const producto = buscarProducto(imagen.producto);
  const color = producto?.colores.find((c) => c.id === imagen.color);
  const titulo = $('.foto__titulo', nodo);
  if (color) titulo.append(muestraDeColor(color.hex));
  const nombre = document.createElement('strong');
  nombre.textContent =
    imagen.categoria === 'galeria' ? 'Galería' : (producto?.nombre ?? imagen.producto ?? 'Sin producto');
  titulo.append(nombre);
  const detalle = [color?.nombre ?? imagen.color, `orden ${imagen.orden}`].filter(Boolean).join(' · ');
  titulo.append(` · ${detalle}`);

  const alt = $('.foto__alt', nodo);
  alt.textContent = imagen.alt || 'Sin texto alternativo';
  alt.classList.toggle('foto__alt--vacio', !imagen.alt);

  const problema = problemaDe(imagen);
  if (problema) {
    const aviso = $('.foto__problema', nodo);
    aviso.hidden = false;
    aviso.textContent = problema;
    aviso.classList.add('foto__problema--grave');
  }

  $('[data-accion="editar"]', nodo).addEventListener('click', () => abrirEdicion(imagen));

  $('[data-accion="copiar"]', nodo).addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(imagen.url);
      avisar('URL copiada');
    } catch {
      window.prompt('Copia la URL:', imagen.url);
    }
  });

  $('[data-accion="borrar"]', nodo).addEventListener('click', async () => {
    if (!window.confirm(`¿Borrar "${imagen.nombreOriginal}"? No se puede deshacer.`)) return;
    try {
      await api(`/imagenes/${imagen.id}`, { method: 'DELETE' });
      avisar('Foto borrada');
      await Promise.all([cargarFotos(), cargarCatalogo()]);
    } catch (e) {
      avisar(e.message);
    }
  });

  return nodo;
}

async function cargarFotos() {
  const soloPendientes = filtro.value === 'pendientes';
  const parametros = filtro.value && !soloPendientes ? `?categoria=${encodeURIComponent(filtro.value)}` : '';
  let imagenes = await api(`/imagenes${parametros}`);
  if (soloPendientes) imagenes = imagenes.filter((i) => problemaDe(i));
  rejilla.replaceChildren(...imagenes.map(pintarFoto));
  $('#total').textContent = `(${imagenes.length})`;
  $('#vacio').hidden = imagenes.length > 0;
}

filtro.addEventListener('change', () => cargarFotos().catch((e) => avisar(e.message)));

/* ---------- Inicio ---------- */

if (token) {
  entrarAlPanel().catch(() => cerrarSesion());
} else {
  mostrar('login');
}
