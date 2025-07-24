document.addEventListener('DOMContentLoaded', () => {
  feather.replace();

  const form = document.getElementById('loginForm');
  const message = document.getElementById('message');

  if (!form) return; // Exit if no login form on page

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    message.textContent = '';
    const formData = new URLSearchParams(new FormData(form));

    try {
      const res = await fetch('/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('access_token', data.access_token);
        message.style.color = 'green';
        message.textContent = 'Login successful! Redirecting...';

        setTimeout(() => {
          window.location.href = '/index';  // Redirect to your main authenticated app page
        }, 1000);
      } else {
        const err = await res.json();
        message.style.color = 'red';
        if (err.detail && err.detail.toLowerCase().includes('incorrect')) {
          message.innerHTML = `Login failed: ${err.detail}.<br>Don't have an account? <a href="/signup" class="text-indigo-600 hover:underline">Sign up here</a>.`;
        } else {
          message.textContent = err.detail || 'Login failed.';
        }
      }
    } catch (error) {
      message.style.color = 'red';
      message.textContent = 'Network error. Please try again later.';
      console.error(error);
    }
  });
});
