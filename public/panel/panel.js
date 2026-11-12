// Panel de aalcuadrado: inicia sesión, administra productos y sube fotos
// (de productos, de la sección "Así se ven", de kits y de velas). También los
// colores y aromas para armar kits, y los tamaños y moldes de las velas.
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
const formGaleria = $('#form-galeria');
const formCategoria = $('#form-categoria');
const formOpcion = $('#form-opcion');
const dialogoEditar = $('#dialogo-editar');
const dialogoProducto = $('#dialogo-producto');
const dialogoCategoria = $('#dialogo-categoria');
const dialogoOpcion = $('#dialogo-opcion');
const formPresentacion = $('#form-presentacion');
const dialogoPresentacion = $('#dialogo-presentacion');
const inputArchivos = formSubir.elements.archivos;
const rejilla = $('#rejilla');
const rejillaProductos = $('#rejilla-productos');
const rejillaGaleria = $('#rejilla-galeria');
const rejillaCategorias = $('#rejilla-categorias');
const rejillaPedidos = $('#rejilla-pedidos');
const rejillaFotosKits = $('#rejilla-fotos-kits');
const rejillaPresentaciones = $('#rejilla-presentaciones');
const rejillaPedidosVelas = $('#rejilla-pedidos-velas');

/** Los tipos de vela, como en la API (src/velas/tipos-vela.ts). Cada uno tiene su categoría de fotos. */
const TIPOS_VELA = {
  recipiente: 'En recipiente',
  molde: 'De molde',
  jicara: 'En jícara',
};
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
  rejillaGaleria.replaceChildren();
  rejillaCategorias.replaceChildren();
  rejillaPedidos.replaceChildren();
  rejillaFotosKits.replaceChildren();
  rejillaPresentaciones.replaceChildren();
  rejillaPedidosVelas.replaceChildren();
  for (const tipo of Object.keys(TIPOS_VELA)) $(`#rejilla-velas-${tipo}`).replaceChildren();
  for (const tipo of Object.values(TIPOS_OPCION)) tipo.rejilla.replaceChildren();
  for (const dialogo of [dialogoEditar, dialogoProducto, dialogoCategoria, dialogoOpcion, dialogoPresentacion]) {
    if (dialogo.open) dialogo.close();
  }
  $('#error-login').textContent = mensaje;
  mostrar('login');
  formLogin.elements.usuario.focus();
}

async function entrarAlPanel() {
  const yo = await api('/usuarios/yo');
  $('#nombre-usuario').textContent = yo.usuario;
  mostrar('panel');
  cambiarPestana(leer(CLAVE_PESTANA) ?? 'fotos');
  await Promise.all([cargarCatalogo(), cargarCategorias()]);
  await Promise.all([
    cargarFotos(),
    cargarGaleria(),
    cargarFotosKits(),
    cargarFotosVelas(),
    cargarOpcionesKit(),
    cargarPresentaciones(),
    cargarPedidos(),
    cargarPedidosVelas(),
  ]);
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
  $('#pestana-categorias').hidden = nombre !== 'categorias';
  $('#pestana-galeria').hidden = nombre !== 'galeria';
  $('#pestana-kits').hidden = nombre !== 'kits';
  $('#pestana-velas').hidden = nombre !== 'velas';
  $('#pestana-pedidos').hidden = nombre !== 'pedidos';
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

/** Después de subir, editar o borrar una foto o un producto: estas vistas dependen de ellos. */
function recargar() {
  return Promise.all([
    cargarFotos(),
    cargarGaleria(),
    cargarCatalogo(),
    cargarCategorias(),
    cargarFotosKits(),
    cargarFotosVelas(),
  ]);
}

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
      $('.producto__coleccion', nodo).textContent = [
        NOMBRES_COLECCION[producto.coleccion] ?? producto.coleccion,
        producto.categoria?.nombre,
      ]
        .filter(Boolean)
        .join(' · ');

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
    campos.categoriaId.value = producto.categoria ? String(producto.categoria.id) : '';
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
    categoriaId: campos.categoriaId.value ? Number(campos.categoriaId.value) : null,
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
    await recargar();
  } catch (e) {
    error.textContent = e.message;
  } finally {
    boton.disabled = false;
  }
});

/* ---------- Categorías de aretes ---------- */

/** Categorías tal como las devuelve `GET /api/categorias`, con `totalProductos`. */
let categorias = [];

async function cargarCategorias() {
  categorias = await api('/categorias');
  llenarCategoriasProducto();
  pintarCategorias();
}

/** Llena el selector de categoría del diálogo de producto, conservando el valor elegido. */
function llenarCategoriasProducto(valor = formProducto.elements.categoriaId.value) {
  const campo = formProducto.elements.categoriaId;
  campo.replaceChildren(opcion('', 'Sin categoría'), ...categorias.map((c) => opcion(String(c.id), c.nombre)));
  campo.value = valor;
}

function pintarCategorias() {
  const plantilla = $('#plantilla-categoria');
  rejillaCategorias.replaceChildren(
    ...categorias.map((categoria) => {
      const nodo = plantilla.content.firstElementChild.cloneNode(true);
      $('.categoria__nombre', nodo).textContent = categoria.nombre;
      $('.categoria__total', nodo).textContent = `${categoria.totalProductos} ${categoria.totalProductos === 1 ? 'arete' : 'aretes'}`;
      $('[data-accion="editar"]', nodo).addEventListener('click', () => abrirCategoria(categoria));
      $('[data-accion="borrar"]', nodo).addEventListener('click', () => borrarCategoria(categoria));
      return nodo;
    }),
  );
  $('#total-categorias').textContent = `(${categorias.length})`;
  $('#vacio-categorias').hidden = categorias.length > 0;
}

$('#boton-nueva-categoria').addEventListener('click', () => abrirCategoria(null));

let categoriaEditando = null;
let slugCategoriaTocado = false;

formCategoria.elements.nombre.addEventListener('input', () => {
  if (!categoriaEditando && !slugCategoriaTocado) {
    formCategoria.elements.slug.value = slugificar(formCategoria.elements.nombre.value);
  }
});
formCategoria.elements.slug.addEventListener('input', () => {
  slugCategoriaTocado = true;
});

function abrirCategoria(categoria) {
  categoriaEditando = categoria;
  slugCategoriaTocado = false;
  formCategoria.reset();
  $('#error-categoria').textContent = '';
  $('#titulo-categoria').textContent = categoria ? `Editar ${categoria.nombre}` : 'Nueva categoría';
  const campos = formCategoria.elements;
  campos.slug.disabled = Boolean(categoria);
  if (categoria) {
    campos.nombre.value = categoria.nombre;
    campos.slug.value = categoria.slug;
    campos.orden.value = categoria.orden ?? '';
  }
  dialogoCategoria.showModal();
  campos.nombre.focus();
}

for (const boton of dialogoCategoria.querySelectorAll('[data-cerrar]')) {
  boton.addEventListener('click', () => dialogoCategoria.close());
}

formCategoria.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const error = $('#error-categoria');
  error.textContent = '';
  if (!formCategoria.reportValidity()) return;

  const campos = formCategoria.elements;
  const datos = {
    ...(categoriaEditando ? {} : { slug: campos.slug.value.trim() || undefined }),
    nombre: campos.nombre.value.trim(),
    orden: campos.orden.value === '' ? null : Number(campos.orden.value),
  };

  const boton = $('#boton-guardar-categoria');
  boton.disabled = true;
  try {
    categoriaEditando
      ? await api(`/categorias/${encodeURIComponent(categoriaEditando.slug)}`, { method: 'PATCH', json: datos })
      : await api('/categorias', { method: 'POST', json: datos });
    dialogoCategoria.close();
    avisar(categoriaEditando ? 'Categoría guardada' : 'Categoría creada');
    await Promise.all([cargarCategorias(), cargarCatalogo()]);
  } catch (e) {
    error.textContent = e.message;
  } finally {
    boton.disabled = false;
  }
});

async function borrarCategoria(categoria) {
  if (categoria.totalProductos > 0) {
    avisar(`Primero quítale la categoría a sus ${categoria.totalProductos} producto(s).`);
    return;
  }
  if (!window.confirm(`¿Borrar "${categoria.nombre}"? No se puede deshacer.`)) return;
  try {
    await api(`/categorias/${encodeURIComponent(categoria.slug)}`, { method: 'DELETE' });
    avisar('Categoría borrada');
    await cargarCategorias();
  } catch (e) {
    avisar(e.message);
  }
}

/* ---------- Pedidos de kits (jabón + vela) ---------- */

let pedidos = [];

async function cargarPedidos() {
  pedidos = await api('/pedidos');
  pintarPedidos();
}

function formatoFecha(fechaIso) {
  return new Date(fechaIso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

function pintarPedidos() {
  const plantilla = $('#plantilla-pedido');
  rejillaPedidos.replaceChildren(
    ...pedidos.map((pedido) => {
      const nodo = plantilla.content.firstElementChild.cloneNode(true);
      $('.pedido__cliente', nodo).textContent = pedido.clienteNombre;
      $('.pedido__fecha', nodo).textContent = formatoFecha(pedido.creadoEn);
      $('.pedido__contacto', nodo).textContent = pedido.clienteContacto;
      $('.pedido__jabon', nodo).textContent =
        `Color ${pedido.jabonColor} · Aroma ${pedido.jabonAroma} · Forma ${pedido.jabonForma}`;
      $('.pedido__vela', nodo).textContent =
        `Color ${pedido.velaColor} · Aroma ${pedido.velaAroma} · Topping ${pedido.velaTopping}`;
      $('[data-accion="borrar"]', nodo).addEventListener('click', () => borrarPedido(pedido));
      return nodo;
    }),
  );
  $('#total-pedidos').textContent = `(${pedidos.length})`;
  $('#vacio-pedidos').hidden = pedidos.length > 0;
}

async function borrarPedido(pedido) {
  if (!window.confirm(`¿Borrar el pedido de ${pedido.clienteNombre}? Hazlo solo cuando ya lo hayas cotizado.`)) return;
  try {
    await api(`/pedidos/${pedido.id}`, { method: 'DELETE' });
    avisar('Pedido borrado');
    await cargarPedidos();
  } catch (e) {
    avisar(e.message);
  }
}

/* ---------- Pedidos de velas ---------- */

let pedidosVelas = [];

async function cargarPedidosVelas() {
  pedidosVelas = await api('/velas/pedidos');
  pintarPedidosVelas();
}

function pintarPedidosVelas() {
  const plantilla = $('#plantilla-pedido-vela');
  rejillaPedidosVelas.replaceChildren(
    ...pedidosVelas.map((pedido) => {
      const nodo = plantilla.content.firstElementChild.cloneNode(true);
      $('.pedido__cliente', nodo).textContent = pedido.clienteNombre;
      $('.pedido__fecha', nodo).textContent = formatoFecha(pedido.creadoEn);
      $('.pedido__contacto', nodo).textContent = pedido.clienteContacto;
      const gramos = pedido.gramos ? ` (${pedido.gramos} g)` : '';
      $('.pedido__titulo', nodo).textContent =
        `${pedido.cantidad} × ${TIPOS_VELA[pedido.tipo] ?? pedido.tipo} · ${pedido.presentacion}${gramos}`;
      $('.pedido__vela', nodo).textContent = [
        `Color ${pedido.color}`,
        pedido.marmoleado && `marmoleada con ${pedido.colorMarmoleado}`,
        `Aroma ${pedido.aroma}`,
        `Topping ${pedido.topping}`,
      ]
        .filter(Boolean)
        .join(' · ');
      if (pedido.notas) {
        const notas = $('.pedido__notas', nodo);
        notas.hidden = false;
        $('p', notas).textContent = pedido.notas;
      }
      $('[data-accion="borrar"]', nodo).addEventListener('click', () => borrarPedidoVela(pedido));
      return nodo;
    }),
  );
  $('#total-pedidos-velas').textContent = `(${pedidosVelas.length})`;
  $('#vacio-pedidos-velas').hidden = pedidosVelas.length > 0;
}

async function borrarPedidoVela(pedido) {
  if (!window.confirm(`¿Borrar el pedido de vela de ${pedido.clienteNombre}? Hazlo solo cuando ya lo hayas cotizado.`)) {
    return;
  }
  try {
    await api(`/velas/pedidos/${pedido.id}`, { method: 'DELETE' });
    avisar('Pedido borrado');
    await cargarPedidosVelas();
  } catch (e) {
    avisar(e.message);
  }
}

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
  const categoria = form.elements.categoria.value;
  form.elements.alt.placeholder =
    categoria === 'galeria'
      ? 'Aretes en su caja, sobre la mesa'
      : categoria === 'kits'
        ? 'Kit de jabón en forma de árbol y vela roja con canela'
        : categoria.startsWith('velas-')
        ? 'Vela mediana en recipiente, color azul marmoleado'
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

for (const zona of document.querySelectorAll('.zona')) {
  for (const tipo of ['dragenter', 'dragover']) {
    zona.addEventListener(tipo, () => zona.classList.add('zona--encima'));
  }
  for (const tipo of ['dragleave', 'drop']) {
    zona.addEventListener(tipo, () => zona.classList.remove('zona--encima'));
  }
}

/** Miniaturas de las fotos elegidas en `input`, dentro de `lista`. */
function previasDe(input, lista) {
  let urls = [];
  const pintar = () => {
    urls.forEach((url) => URL.revokeObjectURL(url));
    urls = [...input.files].map((archivo) => URL.createObjectURL(archivo));
    lista.replaceChildren(
      ...urls.map((url) => {
        const li = document.createElement('li');
        const img = document.createElement('img');
        img.src = url;
        img.alt = '';
        li.append(img);
        return li;
      }),
    );
  };
  input.addEventListener('change', pintar);
  return pintar;
}
const mostrarPrevias = previasDe(inputArchivos, $('#previas'));

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
    await recargar();
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
    await recargar();
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

/** `mover(imagen, paso)`, si se pasa, muestra las flechas para cambiar el orden. */
function pintarFoto(imagen, mover) {
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
    imagen.categoria === 'galeria'
      ? 'Así se ven'
      : imagen.categoria === 'kits'
        ? 'Kits'
        : imagen.categoria.startsWith('velas-')
        ? `Velas · ${TIPOS_VELA[imagen.categoria.slice('velas-'.length)] ?? imagen.categoria}`
        : (producto?.nombre ?? imagen.producto ?? 'Sin producto');
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

  if (mover) {
    for (const [accion, paso] of [['antes', -1], ['despues', 1]]) {
      const boton = $(`[data-accion="${accion}"]`, nodo);
      boton.hidden = false;
      boton.addEventListener('click', () => mover(imagen, paso));
    }
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
      await recargar();
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

/* ---------- Fotos con orden propio: "Así se ven" y kits ---------- */

/**
 * Una sección de fotos de una sola categoría que se ordenan con flechas y se
 * suben al final. La usan "Así se ven" (galeria), "Fotos de kits" (kits) y
 * las fotos de cada tipo de vela (velas-recipiente, velas-molde, velas-jicara).
 */
function seccionDeFotos({ categoria, form, rejilla, total, vacio, previas, error, boton }) {
  /** Las fotos en el orden en que salen en el sitio. */
  let fotos = [];

  async function cargar() {
    fotos = await api(`/imagenes?categoria=${categoria}`);
    rejilla.replaceChildren(
      ...fotos.map((imagen, i) => {
        const nodo = pintarFoto(imagen, mover);
        $('[data-accion="antes"]', nodo).disabled = i === 0;
        $('[data-accion="despues"]', nodo).disabled = i === fotos.length - 1;
        return nodo;
      }),
    );
    total.textContent = `(${fotos.length})`;
    vacio.hidden = fotos.length > 0;
  }

  /** Cambia una foto de lugar y renumera todas (0, 1, 2…) para que el orden quede limpio. */
  async function mover(imagen, paso) {
    const lista = [...fotos];
    const desde = lista.findIndex((i) => i.id === imagen.id);
    const hasta = desde + paso;
    if (hasta < 0 || hasta >= lista.length) return;
    [lista[desde], lista[hasta]] = [lista[hasta], lista[desde]];
    rejilla.setAttribute('aria-busy', 'true');
    try {
      await Promise.all(
        lista.map((foto, orden) =>
          foto.orden === orden ? null : api(`/imagenes/${foto.id}`, { method: 'PATCH', json: { orden } }),
        ),
      );
    } catch (e) {
      avisar(e.message);
    } finally {
      rejilla.removeAttribute('aria-busy');
      await cargar().catch((e) => avisar(e.message));
      if (filtro.value === '' || filtro.value === categoria) cargarFotos().catch((e) => avisar(e.message));
    }
  }

  const mostrarPrevias = previasDe(form.elements.archivos, previas);

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const input = form.elements.archivos;
    error.textContent = '';
    if (input.files.length > 10) {
      error.textContent = 'Sube como máximo 10 fotos por vez.';
      return;
    }

    const datos = new FormData();
    for (const archivo of input.files) datos.append('archivos', archivo);
    datos.append('categoria', categoria);
    // Al final de la sección: después de la que tenga el orden más alto.
    datos.append('orden', String(fotos.reduce((max, f) => Math.max(max, f.orden + 1), 0)));

    boton.disabled = true;
    boton.textContent = 'Subiendo…';
    try {
      const subidas = await api('/imagenes', { method: 'POST', body: datos });
      avisar(subidas.length === 1 ? 'Foto subida' : `${subidas.length} fotos subidas`);
      input.value = '';
      mostrarPrevias();
      await recargar();
    } catch (e) {
      error.textContent = e.estado === 413 ? 'Una de las fotos pesa demasiado.' : e.message;
    } finally {
      boton.disabled = false;
      boton.textContent = 'Subir';
    }
  });

  return cargar;
}

const cargarGaleria = seccionDeFotos({
  categoria: 'galeria',
  form: formGaleria,
  rejilla: rejillaGaleria,
  total: $('#total-galeria'),
  vacio: $('#nota-galeria-vacia'),
  previas: $('#previas-galeria'),
  error: $('#error-galeria'),
  boton: $('#boton-subir-galeria'),
});

const cargarFotosKits = seccionDeFotos({
  categoria: 'kits',
  form: $('#form-kits'),
  rejilla: rejillaFotosKits,
  total: $('#total-fotos-kits'),
  vacio: $('#vacio-fotos-kits'),
  previas: $('#previas-kits'),
  error: $('#error-kits'),
  boton: $('#boton-subir-kits'),
});

/** Una sección por tipo de vela; se cargan juntas. */
const cargasVelas = Object.keys(TIPOS_VELA).map((tipo) =>
  seccionDeFotos({
    categoria: `velas-${tipo}`,
    form: $(`#form-velas-${tipo}`),
    rejilla: $(`#rejilla-velas-${tipo}`),
    total: $(`#total-velas-${tipo}`),
    vacio: $(`#vacio-velas-${tipo}`),
    previas: $(`#previas-velas-${tipo}`),
    error: $(`#error-velas-${tipo}`),
    boton: $(`#boton-subir-velas-${tipo}`),
  }),
);
const cargarFotosVelas = () => Promise.all(cargasVelas.map((cargar) => cargar()));

/* ---------- Colores y aromas de kits ---------- */

/** Lo que cambia entre colores y aromas: ruta de la API, textos y dónde se pintan. */
const TIPOS_OPCION = {
  color: {
    ruta: '/kits/colores',
    nuevo: 'Nuevo color',
    nombre: 'color',
    placeholder: 'Rojo navidad',
    rejilla: $('#rejilla-colores-kit'),
    total: $('#total-colores-kit'),
    vacio: $('#vacio-colores-kit'),
    lista: [],
  },
  aroma: {
    ruta: '/kits/aromas',
    nuevo: 'Nuevo aroma',
    nombre: 'aroma',
    placeholder: 'Canela',
    rejilla: $('#rejilla-aromas-kit'),
    total: $('#total-aromas-kit'),
    vacio: $('#vacio-aromas-kit'),
    lista: [],
  },
};

async function cargarOpcionesKit() {
  await Promise.all(
    Object.entries(TIPOS_OPCION).map(async ([clave, tipo]) => {
      tipo.lista = await api(tipo.ruta);
      pintarOpciones(clave);
    }),
  );
}

function pintarOpciones(clave) {
  const tipo = TIPOS_OPCION[clave];
  const plantilla = $('#plantilla-opcion');
  tipo.rejilla.replaceChildren(
    ...tipo.lista.map((opcion) => {
      const nodo = plantilla.content.firstElementChild.cloneNode(true);
      nodo.classList.toggle('opcion--agotada', !opcion.disponible);
      $('.opcion__nombre', nodo).textContent = opcion.nombre;
      if (opcion.hex) {
        const muestra = $('.opcion__muestra', nodo);
        muestra.hidden = false;
        muestra.style.background = opcion.hex;
        muestra.title = opcion.hex;
      }
      const piezas = [opcion.enJabon && 'Jabón', opcion.enVela && 'Vela'].filter(Boolean).join(' y ');
      const insignias = [piezas, !opcion.disponible && 'No disponible', opcion.orden !== 0 && `orden ${opcion.orden}`];
      $('.opcion__insignias', nodo).replaceChildren(
        ...insignias.filter(Boolean).map((texto) => {
          const span = document.createElement('span');
          span.className = 'insignia';
          if (texto === 'No disponible') span.classList.add('insignia--alerta');
          span.textContent = texto;
          return span;
        }),
      );
      $('[data-accion="editar"]', nodo).addEventListener('click', () => abrirOpcion(clave, opcion));
      $('[data-accion="borrar"]', nodo).addEventListener('click', () => borrarOpcion(clave, opcion));
      return nodo;
    }),
  );
  tipo.total.textContent = `(${tipo.lista.length})`;
  tipo.vacio.hidden = tipo.lista.length > 0;
}

/** Qué se está editando en el diálogo: `{ clave: 'color' | 'aroma', opcion: {...} | null }`. */
let opcionEditando = null;

for (const boton of document.querySelectorAll('[data-nueva-opcion]')) {
  boton.addEventListener('click', () => abrirOpcion(boton.dataset.nuevaOpcion, null));
}

function abrirOpcion(clave, opcion) {
  const tipo = TIPOS_OPCION[clave];
  opcionEditando = { clave, opcion };
  formOpcion.reset();
  $('#error-opcion').textContent = '';
  $('#titulo-opcion').textContent = opcion ? `Editar ${opcion.nombre}` : tipo.nuevo;
  const campos = formOpcion.elements;
  campos.nombre.placeholder = tipo.placeholder;
  const esColor = clave === 'color';
  $('[data-solo-color]', formOpcion).hidden = !esColor;
  campos.hex.disabled = !esColor;
  if (opcion) {
    campos.nombre.value = opcion.nombre;
    if (esColor) campos.hex.value = opcion.hex;
    campos.orden.value = opcion.orden || '';
    campos.enJabon.checked = opcion.enJabon;
    campos.enVela.checked = opcion.enVela;
    campos.disponible.checked = opcion.disponible;
  }
  dialogoOpcion.showModal();
  campos.nombre.focus();
}

for (const boton of dialogoOpcion.querySelectorAll('[data-cerrar]')) {
  boton.addEventListener('click', () => dialogoOpcion.close());
}

formOpcion.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const error = $('#error-opcion');
  error.textContent = '';
  if (!formOpcion.reportValidity() || !opcionEditando) return;

  const campos = formOpcion.elements;
  if (!campos.enJabon.checked && !campos.enVela.checked) {
    error.textContent = 'Marca si es para el jabón, para la vela o para ambos.';
    return;
  }
  const { clave, opcion } = opcionEditando;
  const tipo = TIPOS_OPCION[clave];
  const datos = {
    nombre: campos.nombre.value.trim(),
    ...(clave === 'color' && { hex: campos.hex.value.toUpperCase() }),
    orden: Number(campos.orden.value || 0),
    enJabon: campos.enJabon.checked,
    enVela: campos.enVela.checked,
    disponible: campos.disponible.checked,
  };

  const boton = $('#boton-guardar-opcion');
  boton.disabled = true;
  try {
    opcion
      ? await api(`${tipo.ruta}/${opcion.id}`, { method: 'PATCH', json: datos })
      : await api(tipo.ruta, { method: 'POST', json: datos });
    dialogoOpcion.close();
    avisar(opcion ? 'Cambios guardados' : `"${datos.nombre}" agregado`);
    await cargarOpcionesKit();
  } catch (e) {
    error.textContent = e.message;
  } finally {
    boton.disabled = false;
  }
});

async function borrarOpcion(clave, opcion) {
  const consejo = opcion.disponible ? ' Si solo se te acabó, mejor edítalo y desmarca "Disponible".' : '';
  if (!window.confirm(`¿Borrar el ${TIPOS_OPCION[clave].nombre} "${opcion.nombre}"? No se puede deshacer.${consejo}`)) {
    return;
  }
  try {
    await api(`${TIPOS_OPCION[clave].ruta}/${opcion.id}`, { method: 'DELETE' });
    avisar('Borrado');
    await cargarOpcionesKit();
  } catch (e) {
    avisar(e.message);
  }
}

/* ---------- Tamaños y moldes de velas ---------- */

let presentaciones = [];

async function cargarPresentaciones() {
  presentaciones = await api('/velas/presentaciones');
  pintarPresentaciones();
}

function pintarPresentaciones() {
  const plantilla = $('#plantilla-opcion');
  rejillaPresentaciones.replaceChildren(
    ...presentaciones.map((presentacion) => {
      const nodo = plantilla.content.firstElementChild.cloneNode(true);
      nodo.classList.toggle('opcion--agotada', !presentacion.disponible);
      $('.opcion__nombre', nodo).textContent = `${TIPOS_VELA[presentacion.tipo]} · ${presentacion.nombre}`;
      const insignias = [
        presentacion.gramos ? `${presentacion.gramos} g` : 'Gramos pendientes',
        presentacion.marmoleable && 'Marmoleable',
        !presentacion.disponible && 'No disponible',
        presentacion.orden !== 0 && `orden ${presentacion.orden}`,
      ];
      $('.opcion__insignias', nodo).replaceChildren(
        ...insignias.filter(Boolean).map((texto) => {
          const span = document.createElement('span');
          span.className = 'insignia';
          if (texto === 'No disponible' || texto === 'Gramos pendientes') span.classList.add('insignia--alerta');
          span.textContent = texto;
          return span;
        }),
      );
      $('[data-accion="editar"]', nodo).addEventListener('click', () => abrirPresentacion(presentacion));
      $('[data-accion="borrar"]', nodo).addEventListener('click', () => borrarPresentacion(presentacion));
      return nodo;
    }),
  );
  $('#total-presentaciones').textContent = `(${presentaciones.length})`;
  $('#vacio-presentaciones').hidden = presentaciones.length > 0;
}

/** La que se está editando, o `null` si es nueva. */
let presentacionEditando = null;

/** En jícara el marmoleado no se aprecia: la casilla se apaga. */
function actualizarMarmoleable() {
  const campos = formPresentacion.elements;
  const esJicara = campos.tipo.value === 'jicara';
  campos.marmoleable.disabled = esJicara;
  if (esJicara) campos.marmoleable.checked = false;
  $('#nota-marmoleable').textContent = esJicara ? '(en jícara no se aprecia)' : '';
}

formPresentacion.elements.tipo.addEventListener('change', actualizarMarmoleable);
$('#boton-nueva-presentacion').addEventListener('click', () => abrirPresentacion(null));

function abrirPresentacion(presentacion) {
  presentacionEditando = presentacion;
  formPresentacion.reset();
  $('#error-presentacion').textContent = '';
  $('#titulo-presentacion').textContent = presentacion
    ? `Editar ${TIPOS_VELA[presentacion.tipo].toLowerCase()} · ${presentacion.nombre}`
    : 'Nueva presentación';
  const campos = formPresentacion.elements;
  campos.tipo.disabled = Boolean(presentacion);
  if (presentacion) {
    campos.tipo.value = presentacion.tipo;
    campos.nombre.value = presentacion.nombre;
    campos.gramos.value = presentacion.gramos ?? '';
    campos.orden.value = presentacion.orden || '';
    campos.marmoleable.checked = presentacion.marmoleable;
    campos.disponible.checked = presentacion.disponible;
  }
  actualizarMarmoleable();
  dialogoPresentacion.showModal();
  campos.nombre.focus();
}

for (const boton of dialogoPresentacion.querySelectorAll('[data-cerrar]')) {
  boton.addEventListener('click', () => dialogoPresentacion.close());
}

formPresentacion.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const error = $('#error-presentacion');
  error.textContent = '';
  if (!formPresentacion.reportValidity()) return;

  const campos = formPresentacion.elements;
  const datos = {
    ...(!presentacionEditando && { tipo: campos.tipo.value }),
    nombre: campos.nombre.value.trim(),
    gramos: campos.gramos.value ? Number(campos.gramos.value) : null,
    orden: Number(campos.orden.value || 0),
    marmoleable: campos.marmoleable.checked,
    disponible: campos.disponible.checked,
  };

  const boton = $('#boton-guardar-presentacion');
  boton.disabled = true;
  try {
    presentacionEditando
      ? await api(`/velas/presentaciones/${presentacionEditando.id}`, { method: 'PATCH', json: datos })
      : await api('/velas/presentaciones', { method: 'POST', json: datos });
    dialogoPresentacion.close();
    avisar(presentacionEditando ? 'Cambios guardados' : `"${datos.nombre}" agregada`);
    await cargarPresentaciones();
  } catch (e) {
    error.textContent = e.message;
  } finally {
    boton.disabled = false;
  }
});

async function borrarPresentacion(presentacion) {
  const nombre = `${TIPOS_VELA[presentacion.tipo].toLowerCase()} · ${presentacion.nombre}`;
  const consejo = presentacion.disponible ? ' Si solo dejas de hacerla, mejor edítala y desmarca "Disponible".' : '';
  if (!window.confirm(`¿Borrar "${nombre}"? No se puede deshacer.${consejo}`)) return;
  try {
    await api(`/velas/presentaciones/${presentacion.id}`, { method: 'DELETE' });
    avisar('Borrada');
    await cargarPresentaciones();
  } catch (e) {
    avisar(e.message);
  }
}

/* ---------- Inicio ---------- */

if (token) {
  entrarAlPanel().catch(() => cerrarSesion());
} else {
  mostrar('login');
}
