const SUPABASE_URL = "https://cnaewaauagdgwxeagmde.supabase.co";
const SUPABASE_KEY = "sb_publishable_2YkOFGlyxVNtSnejMC_sLg_7NcPVrKz";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let adminActualId = null;
let adminActualPerfil = null;
let jugadoresGlobal = [];
let usuariosAdminGlobal = [];
let derbyActivo = null;
let actualizandoAdmin = false;
let youtubeActualAdmin = "";

async function verificarAdmin() {
    const estado = document.getElementById("estado");
    const adminPanel = document.getElementById("adminPanel");

    const { data: usuarioData } = await supabaseClient.auth.getUser();

    if (!usuarioData.user) {
        estado.innerText = "No has iniciado sesión.";
        return;
    }

    adminActualId = usuarioData.user.id;

    const { data: perfil, error } = await supabaseClient
        .from("perfiles")
        .select("*")
        .eq("id", usuarioData.user.id)
        .single();

    if (error) {
        estado.innerText = "Error al cargar perfil.";
        return;
    }

    if (perfil.rol !== "admin") {
        estado.innerText = "No tienes permisos de administrador.";
        return;
    }

    adminActualPerfil = perfil;

    estado.innerText = "";
    adminPanel.style.display = "block";

    await actualizarPanelAdmin();
    iniciarAutoActualizacionAdmin();
}

async function actualizarPanelAdmin() {
    if (actualizandoAdmin) return;

    const elementoActivo = document.activeElement;

    if (
        elementoActivo &&
        elementoActivo.tagName === "INPUT" &&
        elementoActivo.id &&
        (
            elementoActivo.id === "youtubeUrl" ||
            elementoActivo.id === "nombreNuevoDerby" ||
            elementoActivo.id === "galloRojo" ||
            elementoActivo.id === "galloVerde" ||
            elementoActivo.id === "buscarUsuarioAdmin" ||
            elementoActivo.id.startsWith("monto-detalle-")
        )
    ) {
        return;
    }

    actualizandoAdmin = true;

    await cargarDerbyActivo();
    await cargarJugadores();
    await cargarUsuariosAdmin();
    await cargarPeleas();
    await cargarCaja();
    cargarVideoYoutubeAdmin();
    await cargarChatAdmin();

    actualizandoAdmin = false;
}

async function cargarDerbyActivo() {
    const { data, error } = await supabaseClient
        .from("derbys")
        .select("*")
        .eq("estado", "activo")
        .order("id", { ascending: false })
        .limit(1)
        .single();

    if (error) {
        document.getElementById("derbyActivo").innerText = "No hay derby activo";
        derbyActivo = null;

        const youtubeInput = document.getElementById("youtubeUrl");
        if (youtubeInput && document.activeElement !== youtubeInput) {
            youtubeInput.value = "";
        }

        return;
    }

    derbyActivo = data;
    document.getElementById("derbyActivo").innerText = `${data.nombre} (#${data.id})`;

    const youtubeInput = document.getElementById("youtubeUrl");

    if (youtubeInput && document.activeElement !== youtubeInput) {
        youtubeInput.value = data.youtube_url || "";
    }
}

function obtenerYoutubeEmbed(url) {
    if (!url) return "";

    if (url.includes("embed/")) {
        return url;
    }

    let videoId = "";

    if (url.includes("watch?v=")) {
        videoId = url.split("watch?v=")[1].split("&")[0];
    } else if (url.includes("youtu.be/")) {
        videoId = url.split("youtu.be/")[1].split("?")[0];
    } else if (url.includes("live/")) {
        videoId = url.split("live/")[1].split("?")[0];
    }

    if (!videoId) return "";

    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0`;
}

function cargarVideoYoutubeAdmin() {
    const contenedor = document.getElementById("videoYoutubeAdmin");

    if (!contenedor) return;

    if (!derbyActivo || !derbyActivo.youtube_url) {
        contenedor.innerHTML = `
            <div class="pelea-card">
                <p>No hay transmisión configurada.</p>
            </div>
        `;
        youtubeActualAdmin = "";
        return;
    }

    const embedUrl = obtenerYoutubeEmbed(derbyActivo.youtube_url);

    if (!embedUrl) {
        contenedor.innerHTML = `
            <div class="pelea-card">
                <p>Link de YouTube inválido.</p>
            </div>
        `;
        youtubeActualAdmin = "";
        return;
    }

    if (youtubeActualAdmin === embedUrl) return;

    youtubeActualAdmin = embedUrl;

    contenedor.innerHTML = `
        <div class="pelea-card">
            <h3>${derbyActivo.nombre}</h3>

            <div style="position:relative; width:100%; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:12px;">
                <iframe
                    src="${embedUrl}"
                    style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen>
                </iframe>
            </div>
        </div>
    `;
}

async function cargarChatAdmin() {
    const lista = document.getElementById("listaChatAdmin");
    const estadoChat = document.getElementById("estadoChatAdmin");
    const input = document.getElementById("mensajeChatAdmin");
    const boton = document.getElementById("btnEnviarChatAdmin");

    if (!lista || !estadoChat || !input || !boton) return;

    if (!adminActualPerfil) return;

    const estabaAbajo =
        lista.scrollTop + lista.clientHeight >= lista.scrollHeight - 50;

    estadoChat.innerText = "";
    input.disabled = false;
    boton.disabled = false;

    const { data: mensajes, error } = await supabaseClient
        .from("chat_mensajes")
        .select(`
            *,
            perfiles (
                usuario,
                rol
            )
        `)
        .order("id", { ascending: false })
        .limit(40);

    if (error) {
        lista.innerHTML = "Error cargando chat.";
        return;
    }

    lista.innerHTML = "";

    const ordenados = (mensajes || []).reverse();

    if (!ordenados.length) {
        lista.innerHTML = "<p>No hay mensajes todavía.</p>";
        return;
    }

    ordenados.forEach(msg => {
        const nombre = msg.perfiles?.usuario || "Usuario";
        const rol = msg.perfiles?.rol || "jugador";
        const esAdmin = rol === "admin";

        const fecha = msg.creado_en
            ? new Date(msg.creado_en).toLocaleTimeString()
            : "";

        lista.innerHTML += `
            <div class="chat-mensaje ${esAdmin ? "chat-admin" : ""}">
                <p>
                    ${esAdmin ? `<span class="admin-badge">ADMIN</span>` : ""}
                    <strong>${nombre}</strong>
                    <span class="chat-fecha">${fecha}</span>
                </p>
                <p>${msg.mensaje}</p>
            </div>
        `;
    });

    if (estabaAbajo) {
        lista.scrollTop = lista.scrollHeight;
    }
}

async function enviarMensajeChatAdmin() {
    const input = document.getElementById("mensajeChatAdmin");
    const estadoChat = document.getElementById("estadoChatAdmin");

    if (!adminActualPerfil || !adminActualId) {
        estadoChat.innerText = "No hay admin cargado.";
        return;
    }

    const mensaje = input.value.trim();

    if (!mensaje) {
        estadoChat.innerText = "Escribe un mensaje.";
        return;
    }

    if (mensaje.length > 300) {
        estadoChat.innerText = "El mensaje es demasiado largo.";
        return;
    }

    estadoChat.innerText = "Enviando...";

    const { error } = await supabaseClient
        .from("chat_mensajes")
        .insert({
            jugador_id: adminActualId,
            mensaje
        });

    if (error) {
        estadoChat.innerText = "Error enviando mensaje: " + error.message;
        return;
    }

    input.value = "";
    estadoChat.innerText = "";

    await cargarChatAdmin();
}

async function crearEventoOverlay(tipo, peleaId, titulo, mensaje, datos = {}) {
    const { error } = await supabaseClient
        .from("overlay_eventos")
        .insert({
            tipo,
            derby_id: derbyActivo?.id || null,
            pelea_id: peleaId,
            titulo,
            mensaje,
            datos
        });

    if (error) {
        console.error("Error creando evento overlay:", error.message);
    }
}

async function guardarYoutubeUrl() {
    const input = document.getElementById("youtubeUrl");
    const mensaje = document.getElementById("mensajeYoutube");

    if (!derbyActivo) {
        mensaje.innerText = "No hay derby activo.";
        return;
    }

    const url = input.value.trim();

    if (!url) {
        mensaje.innerText = "Pega el link de YouTube.";
        return;
    }

    mensaje.innerText = "Guardando transmisión...";

    const { error } = await supabaseClient
        .from("derbys")
        .update({
            youtube_url: url
        })
        .eq("id", derbyActivo.id);

    if (error) {
        mensaje.innerText = "Error: " + error.message;
        return;
    }

    derbyActivo.youtube_url = url;
    youtubeActualAdmin = "";
    cargarVideoYoutubeAdmin();

    mensaje.innerText = "Transmisión guardada correctamente.";
}

async function finalizarDerby() {
    const mensaje = document.getElementById("mensajeDerby");

    if (!derbyActivo) {
        if (mensaje) mensaje.innerText = "No hay derby activo para finalizar.";
        alert("No hay derby activo para finalizar.");
        return;
    }

    const confirmar = confirm(
        `¿Seguro que deseas finalizar el derby "${derbyActivo.nombre}"?

Después de finalizarlo ya no habrá derby activo hasta que inicies uno nuevo.

También se limpiará el chat en vivo.`
    );

    if (!confirmar) return;

    if (mensaje) mensaje.innerText = "Finalizando derby...";

    const { error } = await supabaseClient
        .from("derbys")
        .update({
            estado: "finalizado",
            finalizado_en: new Date().toISOString()
        })
        .eq("id", derbyActivo.id);

    if (error) {
        if (mensaje) mensaje.innerText = "Error finalizando derby: " + error.message;
        alert("Error finalizando derby: " + error.message);
        return;
    }

    const { error: errorChat } = await supabaseClient.rpc("limpiar_chat_admin");

    if (errorChat) {
        alert("Derby finalizado, pero hubo error limpiando el chat: " + errorChat.message);
        if (mensaje) mensaje.innerText = "Derby finalizado, pero hubo error limpiando el chat.";
    } else {
        alert("Derby finalizado correctamente. Chat limpiado.");
        if (mensaje) mensaje.innerText = "Derby finalizado correctamente. Chat limpiado.";
    }

    derbyActivo = null;
    youtubeActualAdmin = "";

    await cargarDerbyActivo();
    await cargarPeleas();
    await cargarCaja();
    cargarVideoYoutubeAdmin();
    await cargarChatAdmin();
}

function formatearDinero(valor) {
    const numero = Number(valor || 0);

    return numero.toLocaleString("es-MX", {
        style: "currency",
        currency: "MXN"
    });
}

function formatearFecha(fecha) {
    if (!fecha) return "-";

    return new Date(fecha).toLocaleString("es-MX");
}

async function obtenerDerbyParaCaja() {
    if (derbyActivo) {
        return {
            derby: derbyActivo,
            tipo: "activo"
        };
    }

    const { data, error } = await supabaseClient
        .from("derbys")
        .select("*")
        .eq("estado", "finalizado")
        .order("finalizado_en", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .single();

    if (error || !data) {
        return {
            derby: null,
            tipo: null
        };
    }

    return {
        derby: data,
        tipo: "ultimo_finalizado"
    };
}

async function cargarCaja() {
    const contenedor = document.getElementById("resumenCaja");

    if (!contenedor) return;

    contenedor.innerHTML = "Cargando caja...";

    const resultadoCaja = await obtenerDerbyParaCaja();
    const derbyCaja = resultadoCaja.derby;
    const tipoCaja = resultadoCaja.tipo;

    if (!derbyCaja) {
        contenedor.innerHTML = `
            <div class="pelea-card">
                <h3>No hay información de caja</h3>
                <p>No hay derby activo ni derby finalizado todavía.</p>
                <p><strong>Total apostado:</strong> ${formatearDinero(0)}</p>
                <p><strong>Ganancia de la casa:</strong> ${formatearDinero(0)}</p>
            </div>
        `;
        return;
    }

    const { data: peleas, error: errorPeleas } = await supabaseClient
        .from("peleas")
        .select("id")
        .eq("derby_id", derbyCaja.id);

    if (errorPeleas) {
        contenedor.innerHTML = "Error cargando peleas del derby: " + errorPeleas.message;
        return;
    }

    const peleaIds = (peleas || []).map(pelea => pelea.id);

    if (!peleaIds.length) {
        contenedor.innerHTML = `
            <div class="pelea-card">
                <h3>${tipoCaja === "activo" ? "Derby activo" : "Último derby finalizado"}</h3>
                <h3>${derbyCaja.nombre}</h3>
                <p><strong>Total apostado:</strong> ${formatearDinero(0)}</p>
                <p><strong>Ganancia de la casa:</strong> ${formatearDinero(0)}</p>
                ${
                    tipoCaja === "ultimo_finalizado"
                    ? `<p><strong>Finalizado:</strong> ${formatearFecha(derbyCaja.finalizado_en)}</p>`
                    : ""
                }
            </div>
        `;
        return;
    }

    const { data: apuestas, error: errorApuestas } = await supabaseClient
        .from("apuestas")
        .select("cantidad_total, comision")
        .in("pelea_id", peleaIds);

    if (errorApuestas) {
        contenedor.innerHTML = "Error cargando apuestas: " + errorApuestas.message;
        return;
    }

    let totalApostado = 0;
    let gananciaCasa = 0;

    (apuestas || []).forEach(apuesta => {
        totalApostado += Number(apuesta.cantidad_total || 0);
        gananciaCasa += Number(apuesta.comision || 0);
    });

    contenedor.innerHTML = `
        <div class="pelea-card">
            <h3>${tipoCaja === "activo" ? "Derby activo" : "Último derby finalizado"}</h3>
            <h3>${derbyCaja.nombre}</h3>

            <p><strong>Total apostado:</strong> ${formatearDinero(totalApostado)}</p>
            <p><strong>Ganancia de la casa:</strong> ${formatearDinero(gananciaCasa)}</p>

            ${
                tipoCaja === "ultimo_finalizado"
                ? `<p><strong>Finalizado:</strong> ${formatearFecha(derbyCaja.finalizado_en)}</p>`
                : ""
            }
        </div>
    `;
}

async function cargarJugadores() {
    const lista = document.getElementById("listaJugadores");
    const detalle = document.getElementById("detalleJugador");

    const detalleAbierto =
        detalle &&
        detalle.style.display === "block";

    if (detalleAbierto) {
        return;
    }

    const { data: jugadores, error } = await supabaseClient
        .from("perfiles")
        .select("*")
        .order("usuario", { ascending: true });

    if (error) {
        lista.innerHTML = "Error cargando jugadores.";
        return;
    }

    jugadoresGlobal = jugadores || [];

    const texto = document.getElementById("buscarJugador")?.value.trim().toLowerCase() || "";

    const filtrados = jugadoresGlobal.filter(jugador => {
        const nombre = (jugador.usuario || jugador.nombre || jugador.id || "").toLowerCase();
        return nombre.includes(texto);
    });

    mostrarListaJugadores(filtrados);
}

function mostrarListaJugadores(jugadores) {
    const lista = document.getElementById("listaJugadores");
    const detalle = document.getElementById("detalleJugador");

    detalle.style.display = "none";
    detalle.innerHTML = "";
    lista.innerHTML = "";

    if (!jugadores.length) {
        lista.innerHTML = "<p>No se encontraron jugadores.</p>";
        return;
    }

    jugadores.forEach(jugador => {
        const nombreMostrar = jugador.usuario || jugador.nombre || jugador.id;
        const saldoMostrar = jugador.saldo || 0;

        lista.innerHTML += `
            <button class="jugador-boton" onclick="abrirDetalleJugador('${jugador.id}')">
                ${nombreMostrar} - Saldo $${saldoMostrar}
            </button>
        `;
    });
}

function abrirDetalleJugador(jugadorId) {
    const jugador = jugadoresGlobal.find(j => j.id === jugadorId);

    if (!jugador) {
        alert("Jugador no encontrado.");
        return;
    }

    const lista = document.getElementById("listaJugadores");
    const detalle = document.getElementById("detalleJugador");

    const nombreMostrar = jugador.usuario || jugador.nombre || jugador.id;
    const saldoMostrar = jugador.saldo || 0;

    lista.innerHTML = "";

    detalle.style.display = "block";
    detalle.innerHTML = `
        <div class="pelea-card">
            <h3>${nombreMostrar}</h3>
            <p><strong>Rol:</strong> ${jugador.rol || "jugador"}</p>
            <p><strong>Saldo actual:</strong> $${saldoMostrar}</p>
            <input type="number" id="monto-detalle-${jugador.id}" placeholder="Cantidad">
            <button onclick="agregarSaldoDetalle('${jugador.id}')">Agregar saldo</button>
            <button onclick="quitarSaldoDetalle('${jugador.id}')">Quitar saldo</button>
            <button onclick="volverListaJugadores()">Volver a lista de jugadores</button>
        </div>
    `;
}

function volverListaJugadores() {
    const texto = document.getElementById("buscarJugador").value.trim().toLowerCase();

    const filtrados = jugadoresGlobal.filter(jugador => {
        const nombre = (jugador.usuario || jugador.nombre || jugador.id || "").toLowerCase();
        return nombre.includes(texto);
    });

    mostrarListaJugadores(filtrados);
}

async function agregarSaldoDetalle(jugadorId) {
    const cantidad = Number(document.getElementById(`monto-detalle-${jugadorId}`).value);

    if (!cantidad || cantidad <= 0) {
        alert("Cantidad inválida");
        return;
    }

    await modificarSaldo(jugadorId, cantidad, "admin_agrega_saldo");
}

async function quitarSaldoDetalle(jugadorId) {
    const cantidad = Number(document.getElementById(`monto-detalle-${jugadorId}`).value);

    if (!cantidad || cantidad <= 0) {
        alert("Cantidad inválida");
        return;
    }

    await modificarSaldo(jugadorId, -cantidad, "admin_quita_saldo");
}
async function modificarSaldo(jugadorId, cambio, tipo) {
    const { data: jugador, error: errorJugador } = await supabaseClient
        .from("perfiles")
        .select("*")
        .eq("id", jugadorId)
        .single();

    if (errorJugador) {
        alert("Error al leer jugador: " + errorJugador.message);
        return;
    }

    const saldoAnterior = Number(jugador.saldo || 0);
    const saldoNuevo = saldoAnterior + Number(cambio);

    if (saldoNuevo < 0) {
        alert("No puedes dejar el saldo en negativo.");
        return;
    }

    const { error: errorActualizar } = await supabaseClient
        .from("perfiles")
        .update({ saldo: saldoNuevo })
        .eq("id", jugadorId);

    if (errorActualizar) {
        alert("Error al actualizar saldo: " + errorActualizar.message);
        return;
    }

    const { error: errorMovimiento } = await supabaseClient.from("movimientos").insert({
        jugador_id: jugadorId,
        tipo: tipo,
        cantidad: Math.abs(cambio),
        estado: "aprobado",
        nota: cambio > 0 ? "Saldo agregado por admin" : "Saldo retirado por admin",
        saldo_anterior: saldoAnterior,
        saldo_nuevo: saldoNuevo,
        admin_id: adminActualId
    });

    if (errorMovimiento) {
        alert("Saldo actualizado, pero no se pudo registrar el movimiento: " + errorMovimiento.message);
    }

    await cargarJugadores();
    abrirDetalleJugador(jugadorId);
}

async function crearPelea() {
    const galloRojo = document.getElementById("galloRojo").value.trim();
    const galloVerde = document.getElementById("galloVerde").value.trim();
    const mensaje = document.getElementById("mensajePelea");

    if (!galloRojo || !galloVerde) {
        mensaje.innerText = "Escribe el nombre de ambos gallos.";
        return;
    }

    if (!derbyActivo) {
        mensaje.innerText = "No hay derby activo. Inicia un nuevo derby primero.";
        return;
    }

    mensaje.innerText = "Creando pelea...";

    const { count, error: errorCount } = await supabaseClient
        .from("peleas")
        .select("*", { count: "exact", head: true })
        .eq("derby_id", derbyActivo.id);

    if (errorCount) {
        mensaje.innerText = "Error al calcular número de pelea: " + errorCount.message;
        return;
    }

    const numeroDerby = (count || 0) + 1;

    const { data: peleaCreada, error } = await supabaseClient
        .from("peleas")
        .insert({
            derby_id: derbyActivo.id,
            numero_derby: numeroDerby,
            titulo: galloRojo + " vs " + galloVerde,
            gallo_rojo: galloRojo,
            gallo_verde: galloVerde,
            zona: "Zona 1",
            estado: "abierta",
            resultado: null
        })
        .select()
        .single();

    if (error) {
        mensaje.innerText = "Error: " + error.message;
        return;
    }

    await crearEventoOverlay(
        "pelea_nueva",
        peleaCreada.id,
        `PELEA #${numeroDerby}`,
        `${galloRojo} VS ${galloVerde}`,
        {
            derby: derbyActivo.nombre,
            numero: numeroDerby,
            rojo: galloRojo,
            verde: galloVerde
        }
    );

    mensaje.innerText = `Pelea #${numeroDerby} creada correctamente.`;
    document.getElementById("galloRojo").value = "";
    document.getElementById("galloVerde").value = "";

    await cargarPeleas();
}

async function cargarPeleas() {
    const lista = document.getElementById("listaPeleas");
    const historial = document.getElementById("historialPeleas");

    const { data: peleas, error } = await supabaseClient
        .from("peleas")
        .select(`*, derbys (id, nombre)`)
        .order("id", { ascending: false });

    if (error) {
        lista.innerHTML = "Error al cargar peleas.";
        historial.innerHTML = "Error al cargar historial.";
        return;
    }

    lista.innerHTML = "";
    historial.innerHTML = "";

    const peleasActivas = peleas.filter(pelea =>
        pelea.estado !== "finalizada" &&
        pelea.estado !== "cancelada"
    );

    const peleasHistorial = peleas.filter(pelea =>
        pelea.estado === "finalizada" ||
        pelea.estado === "cancelada"
    );

    if (!peleasActivas.length) {
        lista.innerHTML = "<p>No hay peleas activas.</p>";
    }

    peleasActivas.forEach(pelea => {
        lista.innerHTML += crearTarjetaPelea(pelea, true);
    });

    if (!peleasHistorial.length) {
        historial.innerHTML = "<p>No hay historial todavía.</p>";
    }

    peleasHistorial.forEach(pelea => {
        historial.innerHTML += crearTarjetaPelea(pelea, false);
    });
}

function crearTarjetaPelea(pelea, mostrarBotones) {
    const numero = pelea.numero_derby || pelea.id;
    const nombreDerby = pelea.derbys?.nombre || "Sin derby";

    let botones = "";

    if (mostrarBotones) {
        if (pelea.estado === "abierta") {
            botones = `<button onclick="cambiarEstadoPelea(${pelea.id}, 'cerrada')">Cerrar apuestas</button>`;
        } else if (pelea.estado === "cerrada") {
            botones = `<button onclick="cambiarEstadoPelea(${pelea.id}, 'en_juego')">En juego</button>`;
        } else if (pelea.estado === "en_juego") {
            botones = `
                <button onclick="finalizarPelea(${pelea.id}, 'rojo')">Ganó ROJO</button>
                <button onclick="finalizarPelea(${pelea.id}, 'verde')">Ganó VERDE</button>
                <button onclick="finalizarPelea(${pelea.id}, 'tablas')">Tablas</button>
                <button onclick="finalizarPelea(${pelea.id}, 'cancelada')">Cancelar</button>
            `;
        }
    }

    return `
        <div class="pelea-card">
            <h3>${nombreDerby}</h3>
            <h3>Pelea #${numero}</h3>
            <p><strong>Zona:</strong> ${pelea.zona || "Zona 1"}</p>
            <p><strong>ROJO:</strong> ${pelea.gallo_rojo}</p>
            <p><strong>VERDE:</strong> ${pelea.gallo_verde}</p>
            <p><strong>Estado:</strong> ${pelea.estado}</p>
            <p><strong>Resultado:</strong> ${pelea.resultado || "Pendiente"}</p>
            ${botones}
        </div>
    `;
}

async function cambiarEstadoPelea(peleaId, nuevoEstado) {
    if (nuevoEstado === "cerrada") {
        const { data, error } = await supabaseClient.rpc(
            "cerrar_apuestas",
            { p_pelea_id: peleaId }
        );

        if (error) {
            alert("Error: " + error.message);
            return;
        }

        alert(data);
        await cargarJugadores();
        await cargarPeleas();
        await cargarCaja();
        return;
    }

    const { error } = await supabaseClient
        .from("peleas")
        .update({ estado: nuevoEstado })
        .eq("id", peleaId);

    if (error) {
        alert("Error: " + error.message);
        return;
    }

    await cargarPeleas();
    await cargarCaja();
}

async function finalizarPelea(peleaId, resultado) {
    if (!confirm("¿Seguro que deseas finalizar esta pelea?")) {
        return;
    }

    const { data, error } = await supabaseClient.rpc(
        "resolver_pelea",
        {
            p_pelea_id: peleaId,
            p_resultado: resultado
        }
    );

    if (error) {
        alert("Error: " + error.message);
        return;
    }

    const { data: pelea } = await supabaseClient
        .from("peleas")
        .select(`
            *,
            derbys (
                id,
                nombre
            )
        `)
        .eq("id", peleaId)
        .single();

    if (pelea) {
        let tipoOverlay = "";
        let tituloOverlay = "";
        let mensajeOverlay = "";

        if (resultado === "rojo") {
            tipoOverlay = "resultado_rojo";
            tituloOverlay = "🏆 GANADOR 🏆";
            mensajeOverlay = pelea.gallo_rojo;
        }

        if (resultado === "verde") {
            tipoOverlay = "resultado_verde";
            tituloOverlay = "🏆 GANADOR 🏆";
            mensajeOverlay = pelea.gallo_verde;
        }

        if (resultado === "tablas") {
            tipoOverlay = "resultado_tablas";
            tituloOverlay = "🤝 RESULTADO 🤝";
            mensajeOverlay = "TABLAS";
        }

        if (resultado === "cancelada") {
            tipoOverlay = "resultado_cancelada";
            tituloOverlay = "⚠ RESULTADO ⚠";
            mensajeOverlay = "PELEA CANCELADA";
        }

        await crearEventoOverlay(
            tipoOverlay,
            peleaId,
            tituloOverlay,
            mensajeOverlay,
            {
                derby: pelea.derbys?.nombre || "",
                pelea: pelea.numero_derby || pelea.id,
                rojo: pelea.gallo_rojo,
                verde: pelea.gallo_verde,
                resultado: resultado
            }
        );
    }

    alert(data);

    await cargarJugadores();
    await cargarPeleas();
    await cargarCaja();
}

function iniciarAutoActualizacionAdmin() {
    setInterval(async () => {
        await cargarDerbyActivo();

        if (!derbyActivo) {
            return;
        }

        await actualizarPanelAdmin();
    }, 3000);
}

document.getElementById("buscarJugador").addEventListener("input", () => {
    const texto = document.getElementById("buscarJugador").value.trim().toLowerCase();

    const filtrados = jugadoresGlobal.filter(jugador => {
        const nombre = (jugador.usuario || jugador.nombre || jugador.id || "").toLowerCase();
        return nombre.includes(texto);
    });

    mostrarListaJugadores(filtrados);
});

document.getElementById("buscarUsuarioAdmin").addEventListener("input", () => {
    const texto = document.getElementById("buscarUsuarioAdmin").value.trim().toLowerCase();
    mostrarUsuariosAdmin(texto);
});

document.getElementById("btnNuevoDerby").addEventListener("click", async () => {
    const nombre = document.getElementById("nombreNuevoDerby").value.trim();

    if (!nombre) {
        alert("Escribe un nombre para el derby.");
        return;
    }

    const { data, error } = await supabaseClient.rpc(
        "iniciar_nuevo_derby",
        { p_nombre: nombre }
    );

    if (error) {
        alert("Error: " + error.message);
        return;
    }

    alert(data);

    document.getElementById("nombreNuevoDerby").value = "";

    await cargarDerbyActivo();
    await cargarPeleas();
    await cargarCaja();
    cargarVideoYoutubeAdmin();
});

document.getElementById("btnFinalizarDerby").addEventListener("click", finalizarDerby);

document.getElementById("btnGuardarYoutube").addEventListener("click", guardarYoutubeUrl);

document.getElementById("btnVolver").addEventListener("click", () => {
    window.location.href = "index.html";
});

document.getElementById("btnSalir").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
});

document.getElementById("btnCrearPelea").addEventListener("click", crearPelea);

document.getElementById("btnEnviarChatAdmin").addEventListener("click", enviarMensajeChatAdmin);

document.getElementById("mensajeChatAdmin").addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
        await enviarMensajeChatAdmin();
    }
});

function mostrarTab(tabId) {
    document.querySelectorAll(".tab-contenido").forEach(tab => {
        tab.style.display = "none";
    });

    document.getElementById(tabId).style.display = "block";

    if (tabId === "tabCaja") {
        cargarCaja();
    }

    if (tabId === "tabSalaVivo") {
        cargarVideoYoutubeAdmin();
        cargarChatAdmin();
    }

    if (tabId === "tabUsuarios") {
        const texto = document.getElementById("buscarUsuarioAdmin")?.value.trim().toLowerCase() || "";
        mostrarUsuariosAdmin(texto);
    }
}

async function cargarUsuariosAdmin() {
    const solicitudes = document.getElementById("solicitudesUsuarios");
    const control = document.getElementById("controlUsuarios");

    if (!solicitudes || !control) return;

    const { data: usuarios, error } = await supabaseClient
        .from("perfiles")
        .select("*")
        .order("usuario", { ascending: true });

    if (error) {
        solicitudes.innerHTML = "Error cargando usuarios: " + error.message;
        return;
    }

    usuariosAdminGlobal = usuarios || [];

    const texto = document.getElementById("buscarUsuarioAdmin")?.value.trim().toLowerCase() || "";
    mostrarUsuariosAdmin(texto);
}

function mostrarUsuariosAdmin(textoBusqueda = "") {
    const solicitudes = document.getElementById("solicitudesUsuarios");
    const control = document.getElementById("controlUsuarios");

    if (!solicitudes || !control) return;

    solicitudes.innerHTML = "";
    control.innerHTML = "";

    const texto = textoBusqueda.trim().toLowerCase();

    const usuariosFiltrados = usuariosAdminGlobal.filter(usuario => {
        const nombre = (usuario.usuario || usuario.nombre || "").toLowerCase();
        const id = (usuario.id || "").toLowerCase();
        const estado = (usuario.estado_cuenta || "").toLowerCase();
        const rol = (usuario.rol || "").toLowerCase();

        return (
            !texto ||
            nombre.includes(texto) ||
            id.includes(texto) ||
            estado.includes(texto) ||
            rol.includes(texto)
        );
    });

    usuariosFiltrados.forEach(usuario => {
        const nombre = usuario.usuario || usuario.nombre || usuario.id;

        if (usuario.estado_cuenta === "pendiente") {
            solicitudes.innerHTML += `
                <div class="pelea-card">
                    <h3>${nombre}</h3>
                    <p>Estado: pendiente</p>

                    <button onclick="aprobarUsuario('${usuario.id}')">
                        Aprobar usuario
                    </button>

                    <button onclick="bloquearUsuario('${usuario.id}')">
                        Rechazar / Bloquear
                    </button>
                </div>
            `;
        } else {
            control.innerHTML += `
                <div class="pelea-card">
                    <h3>${nombre}</h3>
                    <p>Estado: ${usuario.estado_cuenta || "activo"}</p>
                    <p>Saldo: $${usuario.saldo || 0}</p>
                    <p>Chat: ${usuario.chat_muteado ? "Muteado" : "Activo"}</p>

                    ${
                        usuario.estado_cuenta === "bloqueado"
                        ? `<button onclick="desbloquearUsuario('${usuario.id}')">Desbloquear usuario</button>`
                        : `<button onclick="bloquearUsuario('${usuario.id}')">Bloquear usuario</button>`
                    }

                    ${
                        usuario.chat_muteado
                        ? `<button onclick="desmutearUsuario('${usuario.id}')">Desmutear chat</button>`
                        : `<button onclick="mutearUsuario('${usuario.id}')">Mutear chat</button>`
                    }
                </div>
            `;
        }
    });

    if (!solicitudes.innerHTML) {
        solicitudes.innerHTML = texto
            ? "<p>No hay solicitudes pendientes que coincidan con la búsqueda.</p>"
            : "<p>No hay solicitudes pendientes.</p>";
    }

    if (!control.innerHTML) {
        control.innerHTML = texto
            ? "<p>No hay usuarios registrados que coincidan con la búsqueda.</p>"
            : "<p>No hay usuarios registrados.</p>";
    }
}

async function aprobarUsuario(usuarioId) {
    const { error } = await supabaseClient
        .from("perfiles")
        .update({
            estado_cuenta: "activo",
            motivo_bloqueo: null,
            bloqueado_hasta: null
        })
        .eq("id", usuarioId);

    if (error) {
        alert("Error aprobando usuario: " + error.message);
        return;
    }

    alert("Usuario aprobado.");
    await cargarUsuariosAdmin();
    await cargarJugadores();
}

async function bloquearUsuario(usuarioId) {
    const motivo = prompt("Motivo del bloqueo:", "Bloqueado por administrador");

    if (motivo === null) return;

    const { error } = await supabaseClient
        .from("perfiles")
        .update({
            estado_cuenta: "bloqueado",
            motivo_bloqueo: motivo || "Bloqueado por administrador"
        })
        .eq("id", usuarioId);

    if (error) {
        alert("Error bloqueando usuario: " + error.message);
        return;
    }

    alert("Usuario bloqueado.");
    await cargarUsuariosAdmin();
    await cargarJugadores();
}

async function desbloquearUsuario(usuarioId) {
    const { error } = await supabaseClient
        .from("perfiles")
        .update({
            estado_cuenta: "activo",
            motivo_bloqueo: null,
            bloqueado_hasta: null
        })
        .eq("id", usuarioId);

    if (error) {
        alert("Error desbloqueando usuario: " + error.message);
        return;
    }

    alert("Usuario desbloqueado.");
    await cargarUsuariosAdmin();
    await cargarJugadores();
}

async function mutearUsuario(usuarioId) {
    const { error } = await supabaseClient
        .from("perfiles")
        .update({
            chat_muteado: true
        })
        .eq("id", usuarioId);

    if (error) {
        alert("Error muteando usuario: " + error.message);
        return;
    }

    alert("Usuario muteado del chat.");
    await cargarUsuariosAdmin();
}

async function desmutearUsuario(usuarioId) {
    const { error } = await supabaseClient
        .from("perfiles")
        .update({
            chat_muteado: false,
            chat_muteado_hasta: null
        })
        .eq("id", usuarioId);

    if (error) {
        alert("Error desmuteando usuario: " + error.message);
        return;
    }

    alert("Usuario desmuteado.");
    await cargarUsuariosAdmin();
}

verificarAdmin();