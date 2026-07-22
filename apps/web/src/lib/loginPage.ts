import { supabase } from './supabase';

type LoginPageElements = {
  status: HTMLElement | null;
  form: HTMLFormElement | null;
  email: HTMLInputElement | null;
  password: HTMLInputElement | null;
  submitBtn: HTMLButtonElement | null;
  toggleLink: HTMLAnchorElement | null;
  heading: HTMLHeadingElement | null;
};

export async function initLoginPage() {
  const elements: LoginPageElements = {
    status: document.querySelector('#login-status'),
    form: document.querySelector('#login-form'),
    email: document.querySelector('#login-email'),
    password: document.querySelector('#login-password'),
    submitBtn: document.querySelector('#login-submit'),
    toggleLink: document.querySelector('#auth-toggle-link'),
    heading: document.querySelector('#auth-heading')
  };

  let mode: 'login' | 'register' = 'login';

  const setStatus = (message: string, isError = false) => {
    if (!elements.status) return;
    elements.status.textContent = message;
    elements.status.classList.toggle('text-desert-sienna', isError);
    elements.status.classList.toggle('text-slate-mist', !isError);
  };

  const syncModeUi = () => {
    const isRegister = mode === 'register';
    if (elements.heading) {
      elements.heading.textContent = isRegister ? 'Crear cuenta' : 'Iniciar sesion';
    }
    if (elements.submitBtn) {
      elements.submitBtn.title = isRegister ? 'Registrarse' : 'Entrar';
      elements.submitBtn.setAttribute('aria-label', isRegister ? 'Registrarse' : 'Entrar');
    }
    if (elements.toggleLink) {
      elements.toggleLink.textContent = isRegister
        ? 'Ya tienes cuenta? Inicia sesion.'
        : 'Crea una aqui.';
    }
    setStatus(
      isRegister
        ? 'Registrate con email y contrasena para empezar.'
        : 'Ingresa tu usuario y contrasena para continuar.'
    );
  };

  if (!supabase) {
    setStatus('Configuracion incompleta para autenticacion.', true);
    elements.submitBtn?.setAttribute('disabled', 'true');
    return;
  }

  const { data } = await supabase.auth.getSession();
  if (data.session) {
    window.location.href = '/dashboard';
    return;
  }

  syncModeUi();

  elements.toggleLink?.addEventListener('click', (event) => {
    event.preventDefault();
    mode = mode === 'login' ? 'register' : 'login';
    syncModeUi();
  });

  elements.form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = elements.email?.value?.trim();
    const password = elements.password?.value ?? '';
    if (!email || !password) {
      setStatus('Completa email y contrasena.');
      return;
    }
    if (password.length < 6) {
      setStatus('La contrasena debe tener al menos 6 caracteres.', true);
      return;
    }

    setStatus(mode === 'register' ? 'Creando cuenta...' : 'Validando credenciales...');

    if (mode === 'register') {
      const { data: signUpData, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setStatus(formatAuthError(error.message), true);
        return;
      }
      if (signUpData.session) {
        window.location.href = '/dashboard';
        return;
      }
      setStatus('Cuenta creada. Revisa tu email para confirmar el acceso.');
      mode = 'login';
      syncModeUi();
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus(formatAuthError(error.message), true);
      return;
    }
    window.location.href = '/dashboard';
  });
}

function formatAuthError(message: string) {
  if (message === 'Failed to fetch') {
    return 'No se pudo contactar Supabase (revisa PUBLIC_SUPABASE_* y que el proyecto este activo).';
  }
  if (message === 'User already registered') {
    return 'Ese email ya esta registrado. Inicia sesion.';
  }
  return message;
}
