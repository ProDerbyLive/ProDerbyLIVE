const SUPABASE_URL = "https://cnaewaauagdgwxeagmde.supabase.co";
const SUPABASE_KEY = "sb_publishable_2YkOFGlyxVNtSnejMC_sLg_7NcPVrKz";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

function mostrarTabAcceso(tabId) {
    document.querySelectorAll(".tab-contenido").forEach(tab => {
        tab.style.display = "none";
    });

    document.getElementById(tabId).style.display = "block";
    document.getElementById("mensaje").innerText = "";
}

async function revisarPerfilYEntrar(userId) {
    const mensaje = document.getElementById("mensaje");

    const { data: perfil, error } = await supabaseClient
        .from("perfiles")
        .select("*")
        .eq("id", userId)
        .single();

    if (error || !perfil) {
        mensaje.innerText = "No se encontró tu perfil. Contacta al administrador.";
        await supabaseClient.auth.signOut();
        return;
    }

    if (perfil.estado_cuenta === "pendiente") {
        mensaje.innerText = "Tu cuenta está pendiente de aprobación.";
        await supabaseClient.auth.signOut();
        return;
    }

    if (perfil.estado_cuenta === "bloqueado") {
        mensaje.innerText = perfil.motivo_bloqueo
            ? "Tu cuenta está bloqueada. Motivo: " + perfil.motivo_bloqueo
            : "Tu cuenta está bloqueada.";

        await supabaseClient.auth.signOut();
        return;
    }

    if (perfil.rol === "admin") {
        window.location.href = "admin.html";
    } else {
        window.location.href = "jugador.html";
    }
}

async function irASalaSiHaySesion() {
    const { data } = await supabaseClient.auth.getUser();

    if (data.user) {
        await revisarPerfilYEntrar(data.user.id);
    }
}

document
.getElementById("btnLogin")
.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const mensaje = document.getElementById("mensaje");

    if (!email || !password) {
        mensaje.innerText = "Escribe correo y contraseña.";
        return;
    }

    mensaje.innerText = "Iniciando sesión...";

    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

    if (error) {
        mensaje.innerText = error.message;
        return;
    }

    await revisarPerfilYEntrar(data.user.id);
});

document
.getElementById("btnRegistro")
.addEventListener("click", async () => {
    const nombre = document.getElementById("registroNombre").value.trim();
    const email = document.getElementById("registroEmail").value.trim();
    const password = document.getElementById("registroPassword").value;
    const mensaje = document.getElementById("mensaje");

    if (!nombre || !email || !password) {
        mensaje.innerText = "Escribe nombre completo, correo y contraseña.";
        return;
    }

    if (nombre.length < 3) {
        mensaje.innerText = "El nombre debe tener mínimo 3 caracteres.";
        return;
    }

    if (password.length < 6) {
        mensaje.innerText = "La contraseña debe tener mínimo 6 caracteres.";
        return;
    }

    mensaje.innerText = "Creando solicitud...";

    const { data, error } =
        await supabaseClient.auth.signUp({
            email,
            password
        });

    if (error) {
        mensaje.innerText = error.message;
        return;
    }

    const user = data.user;

    if (!user) {
        mensaje.innerText = "Cuenta creada. Revisa tu correo si se requiere confirmación.";
        return;
    }

    const { error: errorPerfil } = await supabaseClient
        .from("perfiles")
        .update({
            usuario: nombre,
            rol: "jugador",
            saldo: 0,
            estado_cuenta: "pendiente",
            chat_muteado: false
        })
        .eq("id", user.id);

    if (errorPerfil) {
        mensaje.innerText = "Cuenta creada, pero hubo error actualizando perfil: " + errorPerfil.message;
        return;
    }

    await supabaseClient.auth.signOut();

    document.getElementById("registroNombre").value = "";
    document.getElementById("registroEmail").value = "";
    document.getElementById("registroPassword").value = "";

    mensaje.innerText = "Solicitud enviada. Espera aprobación del administrador.";
});

irASalaSiHaySesion();