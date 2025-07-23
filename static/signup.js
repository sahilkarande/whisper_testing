document.addEventListener('DOMContentLoaded', () => {
  feather.replace();

  const form = document.getElementById('signupForm');
  const message = document.getElementById('signupMessage');

  if (!form) return; // Exit if no signup form on page

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    message.textContent = '';

    // Convert form data to JSON object
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetch('/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        message.style.color = 'green';
        message.textContent = 'Signup successful! Redirecting to login...';
        form.reset();

        setTimeout(() => {
          window.location.href = '/login'; // Redirect to login page
        }, 1500);
      } else {
        const err = await res.json();
        message.style.color = 'red';
        message.textContent = err.detail || 'Signup failed.';
      }
    } catch (error) {
      message.style.color = 'red';
      message.textContent = 'Network error. Please try again later.';
      console.error(error);
    }
  });
});
