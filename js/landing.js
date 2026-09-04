(function () {
  var applyLinks = document.querySelectorAll('[data-scroll-apply]');
  var form = document.getElementById('apply-form');
  var formFields = document.getElementById('apply-fields');
  var formSuccess = document.getElementById('apply-success');
  var faqs = document.querySelectorAll('.faq-item');

  applyLinks.forEach(function (el) {
    el.addEventListener('click', function (event) {
      event.preventDefault();
      var target = document.getElementById('apply');
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var name = document.getElementById('name');
      if (name) window.setTimeout(function () { name.focus(); }, 400);
    });
  });

  faqs.forEach(function (item) {
    var button = item.querySelector('.faq-q');
    if (!button) return;
    button.addEventListener('click', function () {
      var open = item.classList.contains('is-open');
      faqs.forEach(function (other) { other.classList.remove('is-open'); });
      if (!open) item.classList.add('is-open');
    });
  });

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var actions = document.getElementById('apply-actions');
      if (formFields) formFields.hidden = true;
      if (actions) actions.hidden = true;
      if (formSuccess) formSuccess.hidden = false;
    });
  }
})();
