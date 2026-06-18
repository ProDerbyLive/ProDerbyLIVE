const SUPABASE_URL = "https://cnaewaauagdgwxeagmde.supabase.co";
const SUPABASE_KEY = "sb_publishable_2YkOFGlyxVNtSnejMC_sLg_7NcPVrKz";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let jugadorActual = null;
let derbyActivo = null;
let youtubeActual = "";
let cuentaExpulsada = false;

let actualizandoPeleas = false;
let actualizandoChat = false;
let actualizandoSaldo = false;

let ultimoChatIdVisto = 0;
let contadorMensajesNuevos = 0;
let chatInicializado = false;

function escaparHTML(texto) {
    return String(texto || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatearDinero(valor) {
    const numero = Number(valor || 0);

    return numero.toLocaleString("es-MX", {
        style: "currency",
        currency: "MXN"
    });
}

async function expulsarUsuario(mensajeTexto) {
    if (cuentaExpulsada) return;

    cuentaExpulsada = true;

    const estado = document.getElementById("estado");
    const panel = document.getElementById("jugadorPanel");

    if (panel) panel.style.display = "none";
    if (estado) estado.innerText = mensajeTexto;

    alert(mensajeTexto);

    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
}

async function validarEstadoCuenta(perfil) {
    if (!perfil) return false;

    if (perfil.estado_cuenta === "pendiente") {
        await expulsarUsuario("Tu cuenta está pendiente de aprobación.");
        return false;
    }

    if (perfil.estado_cuenta === "bloqueado") {
        const motivo = perfil.motivo_bloqueo
            ? " Motivo: " + perfil.motivo_bloqueo
            : "";

        await expulsarUsuario("Tu cuenta ha sido bloqueada." + motivo);
        return false;
    }

    return true;
}

async function cargarJugador() {
    const estado = document.getElementById("estado");
    const panel = document.getElementById("jugadorPanel");

    const { data: usuarioData } = await supabaseClient.auth.getUser();

    if (!usuarioData.user) {
        estado.innerText = "No has iniciado sesión.";
        return;
    }

    const { data: perfil, error } = await supabaseClient
        .from("perfiles")
        .select("*")
        .eq("id", usuarioData.user.id)
        .single();

    if (error) {
        estado.innerText = "Error cargando perfil.";
        return;
    }

    const cuentaValida = await validarEstadoCuenta(perfil);

    if (!cuentaValida) return;

    jugadorActual = perfil;

    document.getElementById("usuarioNombre").innerText =
        perfil.usuario || perfil.id;

    document.getElementById("usuarioSaldo").innerText =
        perfil.saldo || 0;

    estado.innerText = "";
    panel.style.display = "block";

    await cargarDerbyActivo();
    cargarVideoYoutube();
    await cargarPeleas();
    await cargarChat();
    await cargarHistorialApuestas();
    await cargarMovimientos();
}

async function actualizarSaldoYEstado() {
    if (!jugadorActual || actualizandoSaldo || cuentaExpulsada) return;

    actualizandoSaldo = true;

    const { data: perfil, error } = await supabaseClient
        .from("perfiles")
        .select("*")
        .eq("id", jugadorActual.id)
        .single();

    if (!error && perfil) {
        const cuentaValida = await validarEstadoCuenta(perfil);

        if (cuentaValida) {
            jugadorActual = perfil;

            const saldo = document.getElementById("usuarioSaldo");
            const nombre = document.getElementById("usuarioNombre");

            if (saldo) saldo.innerText = perfil.saldo || 0;
            if (nombre) nombre.innerText = perfil.usuario || perfil.id;
        }
    }

    actualizandoSaldo = false;
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
        derbyActivo = null;
        return;
    }

    derbyActivo = data;
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

function cargarVideoYoutube() {
    const contenedor = document.getElementById("videoYoutube");

    if (!contenedor) return;

    if (!derbyActivo || !derbyActivo.youtube_url) {
        if (youtubeActual === "sin-video") return;

        youtubeActual = "sin-video";

        contenedor.innerHTML = `
            <div class="pelea-card">
                <p>No hay transmisión configurada.</p>
            </div>
        `;
        return;
    }

    const embedUrl = obtenerYoutubeEmbed(derbyActivo.youtube_url);

    if (!embedUrl) {
        if (youtubeActual === "link-invalido") return;

        youtubeActual = "link-invalido";

        contenedor.innerHTML = `
            <div class="pelea-card">
                <p>Link de YouTube inválido.</p>
            </div>
        `;
        return;
    }

    if (youtubeActual === embedUrl) return;

    youtubeActual = embedUrl;

    contenedor.innerHTML = `
        <div class="pelea-card">
            <h3>${escaparHTML(derbyActivo.nombre)}</h3>

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

function usuarioEstaEscribiendoApuesta() {
    const elementoActivo = document.activeElement;

    return (
        elementoActivo &&
        elementoActivo.tagName === "INPUT" &&
        elementoActivo.id &&
        elementoActivo.id.startsWith("monto-pelea-")
    );
}

async function cargarPeleas() {
    if (actualizandoPeleas || usuarioEstaEscribiendoApuesta()) return;

    actualizandoPeleas = true;

    const lista = document.getElementById("listaPeleas");

    if (!lista) {
        actualizandoPeleas = false;
        return;
    }

    if (!derbyActivo) {
        lista.innerHTML = "No hay derby activo.";
        actualizandoPeleas = false;
        return;
    }

    const { data: peleas, error } = await supabaseClient
        .from("peleas")
        .select("*")
        .eq("estado", "abierta")
        .eq("derby_id", derbyActivo.id)
        .order("numero_derby", { ascending: false });

    if (error) {
        lista.innerHTML = "Error cargando peleas.";
        actualizandoPeleas = false;
        return;
    }

    lista.innerHTML = `
        <div class="pelea-card">
            <h3>${escaparHTML(derbyActivo.nombre)}</h3>
            <p><strong>Derby activo</strong></p>
        </div>
    `;

    if (!peleas.length) {
        lista.innerHTML += "<p>No hay peleas abiertas.</p>";
        actualizandoPeleas = false;
        return;
    }

    peleas.forEach(pelea => {
        const numero = pelea.numero_derby || pelea.id;

        lista.innerHTML += `
            <div class="pelea-card pelea-apuesta-card">
                <h3>Pelea #${escaparHTML(numero)}</h3>

                <p><strong>Derby:</strong> ${escaparHTML(derbyActivo.nombre)}</p>
                <p><strong>Zona:</strong> ${escaparHTML(pelea.zona)}</p>

                <div class="peleadores-grid">
                    <div class="peleador-box peleador-rojo">
                        <span>ROJO</span>
                        <strong>${escaparHTML(pelea.gallo_rojo)}</strong>
                    </div>

                    <div class="peleador-box peleador-verde">
                        <span>VERDE</span>
                        <strong>${escaparHTML(pelea.gallo_verde)}</strong>
                    </div>
                </div>

                <input
                    type="number"
                    id="monto-pelea-${pelea.id}"
                    placeholder="Cantidad"
                >

                <div class="apuestas-grid">

                    <div class="apuesta-lado apuesta-lado-rojo">
                        <button
                            class="btn-apuesta-principal btn-rojo"
                            onclick="apostar(${pelea.id}, 'rojo', 'normal')"
                        >
                            Apostar ROJO
                        </button>

                        <div class="apuesta-80-row">
                            <button
                                class="btn-apuesta-mini btn-rojo"
                                onclick="apostar(${pelea.id}, 'rojo', 'doy80')"
                            >
                                DOY 80
                            </button>

                            <button
                                class="btn-apuesta-mini btn-rojo"
                                onclick="apostar(${pelea.id}, 'rojo', 'agarro80')"
                            >
                                AGARRO 80
                            </button>
                        </div>
                    </div>

                    <div class="apuesta-lado apuesta-lado-verde">
                        <button
                            class="btn-apuesta-principal btn-verde"
                            onclick="apostar(${pelea.id}, 'verde', 'normal')"
                        >
                            Apostar VERDE
                        </button>

                        <div class="apuesta-80-row">
                            <button
                                class="btn-apuesta-mini btn-verde"
                                onclick="apostar(${pelea.id}, 'verde', 'doy80')"
                            >
                                DOY 80
                            </button>

                            <button
                                class="btn-apuesta-mini btn-verde"
                                onclick="apostar(${pelea.id}, 'verde', 'agarro80')"
                            >
                                AGARRO 80
                            </button>
                        </div>
                    </div>

                </div>

                <p id="mensaje-pelea-${pelea.id}"></p>
            </div>
        `;
    });

    actualizandoPeleas = false;
}

async function actualizarDerbyVideoYPeleas() {
    if (usuarioEstaEscribiendoApuesta()) return;

    await cargarDerbyActivo();
    cargarVideoYoutube();
    await cargarPeleas();
}

function chatEstaAbierto() {
    const chatFlotante = document.getElementById("chatFlotante");
    return chatFlotante && chatFlotante.classList.contains("abierto");
}

function actualizarContadorChat() {
    const contador = document.getElementById("contadorChat");

    if (!contador) return;

    if (contadorMensajesNuevos > 0) {
        contador.innerText = contadorMensajesNuevos > 99 ? "99+" : contadorMensajesNuevos;
        contador.classList.add("visible");
    } else {
        contador.innerText = "0";
        contador.classList.remove("visible");
    }
}

async function cargarChat() {
    if (actualizandoChat || !jugadorActual) return;

    actualizandoChat = true;

    const lista = document.getElementById("listaChat");
    const estadoChat = document.getElementById("estadoChat");
    const input = document.getElementById("mensajeChat");
    const boton = document.getElementById("btnEnviarChat");

    if (!lista || !estadoChat || !input || !boton) {
        actualizandoChat = false;
        return;
    }

    const estabaAbajo =
        lista.scrollTop + lista.clientHeight >= lista.scrollHeight - 50;

    if (jugadorActual.chat_muteado) {
        estadoChat.innerText = "Tu chat está muteado por un administrador.";
        input.disabled = true;
        boton.disabled = true;
    } else {
        estadoChat.innerText = "";
        input.disabled = false;
        boton.disabled = false;
    }

    const { data: mensajes, error } = await supabaseClient.rpc(
        "obtener_chat_mensajes",
        { p_limite: 40 }
    );

    if (error) {
        lista.innerHTML = "Error cargando chat.";
        console.error("Error cargando chat jugador:", error.message);
        actualizandoChat = false;
        return;
    }

    lista.innerHTML = "";

    const ordenados = (mensajes || []).reverse();

    const mensajesRecibidos = mensajes || [];
    const maxIdChat = mensajesRecibidos.length
        ? Math.max(...mensajesRecibidos.map(m => Number(m.id || 0)))
        : 0;

    if (!chatInicializado) {
        ultimoChatIdVisto = maxIdChat;
        chatInicializado = true;
        actualizarContadorChat();
    } else if (chatEstaAbierto()) {
        ultimoChatIdVisto = maxIdChat;
        contadorMensajesNuevos = 0;
        actualizarContadorChat();
    } else if (maxIdChat > ultimoChatIdVisto) {
        const nuevos = mensajesRecibidos.filter(msg =>
            Number(msg.id || 0) > ultimoChatIdVisto &&
            msg.jugador_id !== jugadorActual.id
        );

        contadorMensajesNuevos += nuevos.length;
        ultimoChatIdVisto = maxIdChat;
        actualizarContadorChat();
    }

    if (!ordenados.length) {
        lista.innerHTML = "<p>No hay mensajes todavía.</p>";
        actualizandoChat = false;
        return;
    }

    ordenados.forEach(msg => {
        const nombre = msg.usuario || "Usuario";
        const rol = msg.rol || "jugador";
        const esAdmin = rol === "admin";

        const fecha = msg.creado_en
            ? new Date(msg.creado_en).toLocaleTimeString("es-MX")
            : "";

        lista.innerHTML += `
            <div class="chat-mensaje ${esAdmin ? "chat-admin" : ""}">
                <p>
                    ${esAdmin ? `<span class="admin-badge">ADMIN</span>` : ""}
                    <strong>${escaparHTML(nombre)}</strong>
                    <span class="chat-fecha">${escaparHTML(fecha)}</span>
                </p>
                <p>${escaparHTML(msg.mensaje)}</p>
            </div>
        `;
    });

    if (estabaAbajo) {
        lista.scrollTop = lista.scrollHeight;
    }

    actualizandoChat = false;
}

async function enviarMensajeChat() {
    const input = document.getElementById("mensajeChat");
    const estadoChat = document.getElementById("estadoChat");

    if (!jugadorActual) {
        estadoChat.innerText = "No hay usuario cargado.";
        return;
    }

    if (jugadorActual.chat_muteado) {
        estadoChat.innerText = "Tu chat está muteado por un administrador.";
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
            jugador_id: jugadorActual.id,
            mensaje
        });

    if (error) {
        estadoChat.innerText = "Error enviando mensaje: " + error.message;
        return;
    }

    input.value = "";
    estadoChat.innerText = "";

    await cargarChat();
}

async function cargarHistorialApuestas() {
    const historial = document.getElementById("historialApuestas");

    if (!jugadorActual) {
        historial.innerHTML = "No hay jugador cargado.";
        return;
    }

    const { data: apuestas, error } = await supabaseClient
        .from("apuestas")
        .select(`
            *,
            peleas (
                id,
                numero_derby,
                gallo_rojo,
                gallo_verde,
                resultado,
                estado,
                derbys (
                    id,
                    nombre
                )
            )
        `)
        .eq("jugador_id", jugadorActual.id)
        .order("id", { ascending: false });

    if (error) {
        historial.innerHTML = "Error cargando historial.";
        return;
    }

    historial.innerHTML = "";

    if (!apuestas.length) {
        historial.innerHTML = "<p>No tienes apuestas todavía.</p>";
        return;
    }

    apuestas.forEach(apuesta => {
        const pelea = apuesta.peleas;
        const nombreDerby = pelea?.derbys?.nombre || "Sin derby";
        const numeroPelea = pelea?.numero_derby || pelea?.id || apuesta.pelea_id;
        const color = apuesta.color || "";
        const estado = apuesta.estado || "pendiente";

        const tipoApuesta = apuesta.tipo_apuesta || "normal";

        const total = Number(apuesta.cantidad_nominal || apuesta.cantidad_total || apuesta.cantidad || 0);
        const riesgo = Number(apuesta.cantidad_riesgo || total);
        const matcheada = Number(apuesta.cantidad_nominal_matcheada || apuesta.cantidad_matcheada || 0);
        const pendiente = Number(apuesta.cantidad_nominal_pendiente || apuesta.cantidad_pendiente || 0);
        const ganancia = Number(apuesta.ganancia || 0);
        const comision = Number(apuesta.comision || 0);

        let estadoTexto = estado;
        let totalCobrado = 0;
        let desglose = "";
        let tipoTexto = "Normal";

        if (tipoApuesta === "doy80") {
            tipoTexto = "DOY a 80";
        }

        if (tipoApuesta === "agarro80") {
            tipoTexto = "AGARRO a 80";
        }

        if (estado === "ganada") {
            totalCobrado = riesgo + ganancia;
            estadoTexto = "GANADA ✅";
            desglose = `${formatearDinero(riesgo)} riesgo regresado + ${formatearDinero(ganancia)} ganancia neta`;
        } else if (estado === "perdida") {
            estadoTexto = "PERDIDA ❌";
            desglose = "No hubo cobro";
        } else if (estado === "tablas") {
            totalCobrado = riesgo;
            estadoTexto = "TABLAS 🤝";
            desglose = "Riesgo devuelto";
        } else if (estado === "cancelada") {
            totalCobrado = riesgo;
            estadoTexto = "CANCELADA ⚠️";
            desglose = "Riesgo devuelto";
        } else if (estado === "devuelta") {
            totalCobrado = pendiente;
            estadoTexto = "DEVUELTA";
            desglose = "Apuesta pendiente devuelta";
        }

        historial.innerHTML += `
            <div class="pelea-card">
                <h3>${escaparHTML(nombreDerby)}</h3>
                <h3>Pelea #${escaparHTML(numeroPelea)}</h3>

                <p><strong>ROJO:</strong> ${escaparHTML(pelea?.gallo_rojo || "-")}</p>
                <p><strong>VERDE:</strong> ${escaparHTML(pelea?.gallo_verde || "-")}</p>

                <p><strong>Tipo:</strong> ${escaparHTML(tipoTexto)}</p>
                <p><strong>Mi color:</strong> ${escaparHTML(color.toUpperCase())}</p>
                <p><strong>Apuesta nominal:</strong> ${formatearDinero(total)}</p>
                <p><strong>Riesgo real:</strong> ${formatearDinero(riesgo)}</p>
                <p><strong>Casado nominal:</strong> ${formatearDinero(matcheada)}</p>
                <p><strong>Pendiente nominal:</strong> ${formatearDinero(pendiente)}</p>

                <p><strong>Estado:</strong> ${escaparHTML(estadoTexto)}</p>

                <p><strong>Ganancia neta:</strong> ${formatearDinero(ganancia)}</p>
                <p><strong>Comisión:</strong> ${formatearDinero(comision)}</p>

                <p><strong>Total cobrado:</strong> ${formatearDinero(totalCobrado)}</p>
                <p><strong>Desglose:</strong> ${escaparHTML(desglose)}</p>
            </div>
        `;
    });
}

async function cargarMovimientos() {
    const contenedor = document.getElementById("listaMovimientos");

    if (!jugadorActual) {
        contenedor.innerHTML = "No hay jugador cargado.";
        return;
    }

    const { data: movimientos, error } = await supabaseClient
        .from("movimientos")
        .select(`
            *,
            admin:admin_id (
                usuario,
                nombre
            )
        `)
        .eq("jugador_id", jugadorActual.id)
        .in("tipo", ["admin_agrega_saldo", "admin_quita_saldo"])
        .order("id", { ascending: false });

    if (error) {
        contenedor.innerHTML = "Error cargando movimientos.";
        return;
    }

    contenedor.innerHTML = "";

    if (!movimientos.length) {
        contenedor.innerHTML = "<p>No tienes depósitos o retiros todavía.</p>";
        return;
    }

    movimientos.forEach(mov => {
        const adminNombre =
            mov.admin?.usuario ||
            mov.admin?.nombre ||
            "Administrador";

        const signo = mov.tipo === "admin_agrega_saldo" ? "+" : "-";

        const fecha = mov.creado_en
            ? new Date(mov.creado_en).toLocaleString("es-MX")
            : "";

        const tipoTexto =
            mov.tipo === "admin_agrega_saldo"
                ? "Depósito aprobado"
                : "Retiro aprobado";

        const notaOriginal = mov.nota || "";

const notaMostrar =
    notaOriginal &&
    !notaOriginal.includes("por admin")
        ? notaOriginal
        : (
            mov.tipo === "admin_agrega_saldo"
                ? `Saldo agregado por ${adminNombre}`
                : `Saldo retirado por ${adminNombre}`
        );

        contenedor.innerHTML += `
            <div class="pelea-card">
                <h3>${escaparHTML(tipoTexto)}</h3>

                <p><strong>Fecha:</strong> ${escaparHTML(fecha)}</p>
                <p><strong>Cantidad:</strong> ${escaparHTML(signo)}$${escaparHTML(mov.cantidad)}</p>
                <p><strong>Estado:</strong> ${escaparHTML(mov.estado)}</p>

                <p><strong>Saldo anterior:</strong> $${escaparHTML(mov.saldo_anterior || 0)}</p>
                <p><strong>Saldo nuevo:</strong> $${escaparHTML(mov.saldo_nuevo || 0)}</p>

                <p><strong>Nota:</strong> ${escaparHTML(notaMostrar)}</p>
                <p><strong>Autorizado por:</strong> ${escaparHTML(
                   (mov.nota || "")
                       .replace("Saldo agregado por ", "")
                       .replace("Saldo retirado por ", "")
                       .replace("Saldro agregado por ", "")
                       .replace("Saldro retirado por ", "")
                       .trim() || adminNombre
                )}</p>
            </div>
        `;
    });
}

async function apostar(peleaId, color, tipoApuesta = "normal") {
    const input = document.getElementById(`monto-pelea-${peleaId}`);
    const mensaje = document.getElementById(`mensaje-pelea-${peleaId}`);

    const cantidad = Number(input.value);

    if (!cantidad || cantidad <= 0) {
        mensaje.innerText = "Cantidad inválida.";
        return;
    }

    if (!jugadorActual || jugadorActual.estado_cuenta !== "activo") {
        mensaje.innerText = "Tu cuenta no está activa.";
        return;
    }

    let tipoTexto = "normal";
    let riesgoTexto = "";

    if (tipoApuesta === "doy80") {
        tipoTexto = "DOY a 80";
        riesgoTexto = `Arriesgas ${formatearDinero(cantidad)}. Si ganas, tu ganancia bruta será ${formatearDinero(cantidad * 0.80)} menos comisión.`;
    } else if (tipoApuesta === "agarro80") {
        tipoTexto = "AGARRO a 80";
        riesgoTexto = `Apuestas nominalmente ${formatearDinero(cantidad)}, pero solo arriesgas ${formatearDinero(cantidad * 0.80)}. Si ganas, tu ganancia bruta será ${formatearDinero(cantidad)} menos comisión.`;
    } else {
        riesgoTexto = `Apuesta normal por ${formatearDinero(cantidad)}.`;
    }

    const confirmar = confirm(
        `Confirmar apuesta ${tipoTexto.toUpperCase()} al ${color.toUpperCase()}\n\n${riesgoTexto}`
    );

    if (!confirmar) return;

    mensaje.innerText = "Procesando apuesta...";

    const { data, error } = await supabaseClient.rpc(
        "realizar_apuesta",
        {
            p_pelea_id: peleaId,
            p_color: color,
            p_cantidad: cantidad,
            p_tipo_apuesta: tipoApuesta
        }
    );

    if (error) {
        mensaje.innerText = "Error: " + error.message;
        return;
    }

    mensaje.innerText = data;
    input.value = "";

    await actualizarSaldoYEstado();
    await cargarPeleas();
    await cargarHistorialApuestas();
    await cargarMovimientos();
}

function mostrarTabJugador(tabId) {
    document.querySelectorAll(".tab-contenido").forEach(tab => {
        tab.style.display = "none";
    });

    document.getElementById(tabId).style.display = "block";

    if (tabId === "tabHistorial") {
        cargarHistorialApuestas();
    }

    if (tabId === "tabMovimientos") {
        cargarMovimientos();
    }

    if (tabId === "tabApuestas") {
        cargarPeleas();
    }
}

function abrirChatFlotante(){
    const chatFlotante = document.getElementById("chatFlotante");
    const chatOverlay = document.getElementById("chatOverlay");

    contadorMensajesNuevos = 0;
    actualizarContadorChat();

    if (chatFlotante) chatFlotante.classList.add("abierto");
    if (chatOverlay) chatOverlay.classList.add("activo");

    setTimeout(() => {
        const lista = document.getElementById("listaChat");
        if (lista) lista.scrollTop = lista.scrollHeight;
    }, 100);
}

function cerrarChatFlotanteFn(){
    const chatFlotante = document.getElementById("chatFlotante");
    const chatOverlay = document.getElementById("chatOverlay");

    if (chatFlotante) chatFlotante.classList.remove("abierto");
    if (chatOverlay) chatOverlay.classList.remove("activo");
}

document
.getElementById("btnVolver")
.addEventListener("click", () => {
    window.location.href = "index.html";
});

document
.getElementById("btnSalir")
.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
});

document
.getElementById("btnEnviarChat")
.addEventListener("click", enviarMensajeChat);

document
.getElementById("mensajeChat")
.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
        await enviarMensajeChat();
    }
});

document
.getElementById("chatFloatBtn")
.addEventListener("click", abrirChatFlotante);

document
.getElementById("cerrarChatBtn")
.addEventListener("click", cerrarChatFlotanteFn);

document
.getElementById("chatOverlay")
.addEventListener("click", cerrarChatFlotanteFn);

setInterval(cargarChat, 3000);
setInterval(actualizarSaldoYEstado, 5000);

setInterval(async () => {
    if (!jugadorActual || usuarioEstaEscribiendoApuesta()) return;

    await cargarDerbyActivo();
    await cargarPeleas();
}, 3000);

cargarJugador();
