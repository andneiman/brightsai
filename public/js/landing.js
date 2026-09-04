(function () {
  var applyLinks = document.querySelectorAll("[data-scroll-apply]");
  var form = document.getElementById("apply-form");
  var formFields = document.getElementById("apply-fields");
  var formSuccess = document.getElementById("apply-success");
  var formError = document.getElementById("apply-error");
  var submitBtn = document.getElementById("apply-submit");
  var faqs = document.querySelectorAll(".faq-item");

  applyLinks.forEach(function (el) {
    el.addEventListener("click", function (event) {
      event.preventDefault();
      var target = document.getElementById("apply");
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      var name = document.getElementById("name");
      if (name) window.setTimeout(function () { name.focus(); }, 400);
    });
  });

  faqs.forEach(function (item) {
    var button = item.querySelector(".faq-q");
    if (!button) return;
    button.addEventListener("click", function () {
      var open = item.classList.contains("is-open");
      faqs.forEach(function (other) { other.classList.remove("is-open"); });
      if (!open) item.classList.add("is-open");
    });
  });

  function showError(message) {
    if (!formError) return;
    formError.hidden = !message;
    formError.textContent = message || "";
  }

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (form.dataset.busy === "1") return;

      var name = (document.getElementById("name").value || "").trim();
      var email = (document.getElementById("email").value || "").trim();
      var portfolio = (document.getElementById("portfolio").value || "").trim();

      if (!name) {
        showError("Please enter your name.");
        document.getElementById("name").focus();
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError("Please enter a valid work email.");
        document.getElementById("email").focus();
        return;
      }

      showError("");
      form.dataset.busy = "1";
      if (submitBtn) submitBtn.textContent = "Sending…";

      fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          email: email,
          portfolio: portfolio,
          source: "landing",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: navigator.language,
          screen: window.screen.width + "x" + window.screen.height,
        }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("bad");
          var actions = document.getElementById("apply-actions");
          if (formFields) formFields.hidden = true;
          if (actions) actions.hidden = true;
          if (formSuccess) formSuccess.hidden = false;
        })
        .catch(function () {
          showError("Something went wrong. Please try again.");
          form.dataset.busy = "0";
          if (submitBtn) submitBtn.textContent = "Apply Now";
        });
    });
  }
})();
