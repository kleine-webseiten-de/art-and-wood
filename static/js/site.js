// Browser behaviour: menu, product photos, tabs, side panels, quick view, price slider.
const quickView = document.getElementById("quick-view");
const backdrop = document.getElementById("drawer-backdrop");
let openedDrawer = null;
let drawerOpener = null;

const openDrawer = (id, opener) => {
  if (openedDrawer) closeDrawer();
  openedDrawer = document.getElementById(id);
  drawerOpener = opener;
  openedDrawer.inert = false;
  openedDrawer.classList.add("open");
  backdrop.classList.add("open");
  document.body.classList.add("drawer-open");
  openedDrawer.querySelector("[data-close-drawer]").focus();
};

function closeDrawer() {
  if (!openedDrawer) return;
  openedDrawer.classList.remove("open");
  openedDrawer.inert = true;
  backdrop.classList.remove("open");
  document.body.classList.remove("drawer-open");
  openedDrawer = null;
  drawerOpener?.focus();
}

const openQuickView = async (url) => {
  let response;
  try {
    response = await fetch(url);
  } catch {
    showNotice(document.body.dataset.networkError);
    return;
  }
  if (!response.ok) return;
  document.getElementById("quick-view-body").innerHTML = await response.text();
  initColorPickers(document.getElementById("quick-view-body"));
  quickView.showModal();
};

const showNotice = (text) => {
  const notice = document.createElement("div");
  notice.className = "message error";
  notice.textContent = text;
  document.getElementById("messages").append(notice);
  setTimeout(() => notice.remove(), 6000);
};

const setBadge = (id, count) => {
  const badge = document.getElementById(id);
  badge.textContent = count;
  badge.hidden = count === 0;
};

// Sends a form without reloading the page. If the server broke, opens the error page.
const postForm = async (form, submitter) => {
  const body = new FormData(form);
  if (submitter?.name) body.set(submitter.name, submitter.value);
  try {
    const response = await fetch(form.action, { method: "POST", body, headers: { "X-Requested-With": "fetch" } });
    if (response.status >= 500) {
      window.location.href = document.body.dataset.errorUrl;
      return null;
    }
    return response;
  } catch {
    showNotice(document.body.dataset.networkError);
    return null;
  }
};

document.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-toggle]");
  if (toggle) {
    const target = document.getElementById(toggle.dataset.toggle);
    toggle.setAttribute("aria-expanded", target.classList.toggle("open"));
  }

  const thumb = event.target.closest("[data-photo]");
  if (thumb) {
    const gallery = thumb.closest("[data-gallery]");
    gallery.querySelector("[data-main-photo]").src = thumb.dataset.photo;
    gallery.querySelectorAll("[data-photo]").forEach((item) => item.classList.toggle("active", item === thumb));
  }

  const tab = event.target.closest("[data-tab]");
  if (tab) {
    document.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("active", item === tab));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === tab.dataset.tab));
  }

  const drawerButton = event.target.closest("[data-open-drawer]");
  if (drawerButton) {
    event.preventDefault();
    openDrawer(drawerButton.dataset.openDrawer, drawerButton);
  }
  if (event.target.closest("[data-close-drawer]")) closeDrawer();

  // Ctrl + click is left to the browser: that way the product opens in a new tab.
  const quickLink = event.target.closest("[data-quick-view]");
  if (quickLink && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    event.preventDefault();
    openQuickView(quickLink.dataset.quickView);
  }
  if (event.target.closest("[data-close-quick]") || event.target === quickView) quickView.close();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !quickView.open) closeDrawer();
});

document.addEventListener("submit", async (event) => {
  // "Buy" stays a normal link to checkout.
  const cartForm = event.target.closest("[data-cart-form]");
  if (cartForm && event.submitter?.name !== "buy_now") {
    event.preventDefault();
    const response = await postForm(cartForm, event.submitter);
    if (!response) return;
    const data = await response.json();
    document.getElementById("cart-items").innerHTML = data.html;
    setBadge("cart-badge", data.count);
    if (data.error) showNotice(data.error);
    if (quickView.open) quickView.close();
    if (openedDrawer?.id === "cart-drawer") {
      openedDrawer.querySelector("[data-close-drawer]").focus();
    } else {
      openDrawer("cart-drawer", document.getElementById("cart-button"));
    }
  }
});

const range = document.querySelector("[data-price-range]");
if (range) {
  // The slider works in hryvnias, and the label shows the chosen currency.
  const formatPrice = (value) => {
    const converted = Math.round(Number(value) / Number(range.dataset.rate));
    return range.dataset.symbol + converted.toLocaleString("uk-UA").replace(/\s/g, "\u00a0");
  };
  const [low, high] = range.querySelectorAll("input");
  const label = document.getElementById("price-label");
  const update = (changed) => {
    if (Number(low.value) > Number(high.value)) {
      if (changed === low) low.value = high.value; else high.value = low.value;
    }
    label.textContent = `${formatPrice(low.value)} – ${formatPrice(high.value)}`;
  };
  low.addEventListener("input", () => update(low));
  high.addEventListener("input", () => update(high));
  update();
}

// Sorting is applied right after it is chosen.
document.querySelector("[data-autosubmit]")?.addEventListener("change", (event) => event.target.form.submit());

// Messages disappear by themselves after 6 seconds.
document.querySelectorAll(".message").forEach((item) => setTimeout(() => item.remove(), 6000));

// Password check while typing: errors show up in red right away.
const passwordForm = document.querySelector("[data-password-check]");
if (passwordForm) {
  const password = passwordForm.querySelector('[name="password1"], [name="new_password1"]');
  const repeat = passwordForm.querySelector('[name="password2"], [name="new_password2"]');
  const email = passwordForm.querySelector('[name="email"]');
  const firstName = passwordForm.querySelector('[name="first_name"]');
  const box = document.getElementById("password-message");
  const matchBox = document.getElementById("password-match-message");
  const emailBox = document.getElementById("email-message");
  let timer;
  let lastRequest = 0;

  const markInput = (input, isValid) => {
    input.classList.toggle("input-error", isValid === false);
    input.classList.toggle("input-ok", isValid === true);
  };

  const showPasswordResult = (errors) => {
    const items = errors.map((text) => {
      const item = document.createElement("li");
      item.className = "bad";
      item.textContent = text;
      return item;
    });
    if (!errors.length && password.value) {
      const item = document.createElement("li");
      item.className = "good";
      item.textContent = passwordForm.dataset.passwordOk;
      items.push(item);
      box.replaceChildren(item);
    } else {
      box.replaceChildren(...items);
    }
    box.classList.toggle("good", !errors.length);
    markInput(password, password.value ? !errors.length : null);
  };

  const checkPassword = async () => {
    const request = ++lastRequest;
    if (!password.value) {
      showPasswordResult([]);
      return;
    }
    const body = new FormData();
    body.set("csrfmiddlewaretoken", passwordForm.querySelector("[name=csrfmiddlewaretoken]").value);
    body.set("password", password.value);
    body.set("email", email?.value || "");
    body.set("first_name", firstName?.value || "");
    try {
      const response = await fetch(passwordForm.dataset.passwordCheck, { method: "POST", body });
      const data = await response.json();
      // An answer for old text is ignored: the person may already have typed more.
      if (request === lastRequest) showPasswordResult(data.errors);
    } catch {
      // Without a connection the server still checks everything when the form is sent.
    }
  };

  const checkMatch = () => {
    const matches = password.value === repeat.value;
    matchBox.textContent = repeat.value && !matches ? passwordForm.dataset.passwordMismatch : "";
    matchBox.classList.toggle("bad", Boolean(repeat.value) && !matches);
    markInput(repeat, repeat.value ? matches : null);
  };

  password.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(checkPassword, 250);
    checkMatch();
  });
  repeat.addEventListener("input", checkMatch);

  email?.addEventListener("blur", () => {
    const isValid = !email.value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value);
    emailBox.textContent = isValid ? "" : passwordForm.dataset.emailInvalid;
    emailBox.classList.toggle("bad", !isValid);
    markInput(email, email.value ? isValid : null);
  });

  passwordForm.querySelector("[data-show-passwords]")?.addEventListener("change", (event) => {
    const type = event.target.checked ? "text" : "password";
    password.type = type;
    repeat.type = type;
  });
}

// Card form. The data stays only in the browser: the fields have no name attribute.
const cardForm = document.getElementById("card-form");
if (cardForm) {
  const input = (id) => document.getElementById(id);
  const number = input("card-number");
  const expiry = input("card-expiry");
  const cvv = input("card-cvv");
  const holder = input("card-holder");
  const digits = (text) => text.replace(/\D/g, "");

  // Luhn algorithm: a checksum that catches mistakes in a card number.
  const passesLuhn = (value) => {
    let sum = 0;
    [...value].reverse().forEach((char, index) => {
      let digit = Number(char);
      if (index % 2 === 1) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    });
    return sum % 10 === 0;
  };

  const isFutureExpiry = (value) => {
    const match = value.match(/^(\d{2})\/(\d{2})$/);
    if (!match) return false;
    const month = Number(match[1]);
    const lastDay = new Date(2000 + Number(match[2]), month, 0, 23, 59);
    return month >= 1 && month <= 12 && lastDay >= new Date();
  };

  const rules = {
    number: [number, () => digits(number.value).length === 16 && passesLuhn(digits(number.value))],
    expiry: [expiry, () => isFutureExpiry(expiry.value)],
    cvv: [cvv, () => /^\d{3}$/.test(cvv.value)],
    holder: [holder, () => /^[A-Za-z' -]{2,}\s+[A-Za-z' -]{2,}$/.test(holder.value.trim())],
  };

  const showFieldError = (name) => {
    const [field, isValid] = rules[name];
    const valid = isValid();
    const message = cardForm.querySelector(`[data-card-error="${name}"]`);
    message.textContent = valid ? "" : cardForm.dataset[`error${name[0].toUpperCase()}${name.slice(1)}`];
    field.classList.toggle("input-error", !valid);
    return valid;
  };

  number.addEventListener("input", () => {
    const value = digits(number.value).slice(0, 16);
    number.value = value.replace(/(\d{4})(?=\d)/g, "$1 ");
    input("card-preview-number").textContent = (number.value + "•••• •••• •••• ••••".slice(number.value.length));
    input("card-brand").textContent = value[0] === "4" ? "VISA" : value[0] === "5" ? "Mastercard" : "";
  });
  expiry.addEventListener("input", () => {
    const value = digits(expiry.value).slice(0, 4);
    expiry.value = value.length > 2 ? `${value.slice(0, 2)}/${value.slice(2)}` : value;
    input("card-preview-expiry").textContent = expiry.value || "MM/YY";
  });
  cvv.addEventListener("input", () => {
    cvv.value = digits(cvv.value).slice(0, 3);
  });
  holder.addEventListener("input", () => {
    input("card-preview-holder").textContent = holder.value || "NAME SURNAME";
  });
  Object.keys(rules).forEach((name) => rules[name][0].addEventListener("blur", () => {
    if (rules[name][0].value) showFieldError(name);
  }));
  // When a person corrects a field, the red message disappears right away.
  Object.keys(rules).forEach((name) => rules[name][0].addEventListener("input", () => {
    if (rules[name][0].classList.contains("input-error")) showFieldError(name);
  }));

  document.querySelector("[data-requires-card]").addEventListener("submit", (event) => {
    const results = Object.keys(rules).map(showFieldError);
    if (results.includes(false)) {
      event.preventDefault();
      cardForm.querySelector(".input-error")?.focus();
    }
  });
}

// The pay button is disabled after clicking, so the form is not sent twice.
document.addEventListener("submit", (event) => {
  if (!event.defaultPrevented && event.target.closest(".payment-actions")) {
    event.target.querySelector("button").disabled = true;
  }
});

// Announcement bar: hidden for good once closed, until the administrator writes a new text.
const announcement = document.querySelector("[data-announcement]");
if (announcement) {
  const storageKey = `announcement-closed:${announcement.dataset.announcement}`;
  let closed = false;
  try {
    closed = localStorage.getItem(storageKey) === "1";
  } catch {
    // Private mode or blocked storage: just show the bar.
  }
  announcement.hidden = closed;
  announcement.querySelector("[data-close-announcement]").addEventListener("click", () => {
    announcement.hidden = true;
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // Nothing to remember it in; it will show again on the next page.
    }
  });
}

// Full-screen photo viewer. Photos of one product (or one review) share a data-lightbox-group.
const lightbox = document.getElementById("lightbox");
const lightboxImage = lightbox.querySelector("[data-lightbox-image]");
let lightboxPhotos = [];
let lightboxIndex = 0;

const showLightboxPhoto = (index) => {
  lightboxIndex = (index + lightboxPhotos.length) % lightboxPhotos.length;
  lightboxImage.classList.remove("shown");
  lightboxImage.src = lightboxPhotos[lightboxIndex];
  lightbox.querySelector("[data-lightbox-counter]").textContent = `${lightboxIndex + 1} / ${lightboxPhotos.length}`;
  lightbox.classList.toggle("single", lightboxPhotos.length < 2);
};
lightboxImage.addEventListener("load", () => lightboxImage.classList.add("shown"));

const openLightbox = (group, startPhoto) => {
  const items = document.querySelectorAll(`[data-lightbox-group="${CSS.escape(group)}"]`);
  lightboxPhotos = [...new Set([...items].map((item) => item.dataset.lightboxSrc))];
  if (!lightboxPhotos.length) return;
  showLightboxPhoto(Math.max(0, lightboxPhotos.indexOf(startPhoto)));
  lightbox.showModal();
};

document.addEventListener("click", (event) => {
  const opener = event.target.closest("[data-lightbox-open]");
  if (opener) {
    event.preventDefault();
    // The zoom button opens whatever photo is currently big on the page.
    const mainPhoto = opener.closest("[data-gallery]")?.querySelector("[data-main-photo]");
    const startPhoto = opener.dataset.lightboxSrc || mainPhoto?.getAttribute("src");
    openLightbox(opener.dataset.lightboxOpen, startPhoto);
  }
  const step = event.target.closest("[data-lightbox-step]");
  if (step) showLightboxPhoto(lightboxIndex + Number(step.dataset.lightboxStep));
  if (event.target.closest("[data-lightbox-close]") || event.target === lightbox) lightbox.close();
});

document.addEventListener("keydown", (event) => {
  if (!lightbox.open || lightboxPhotos.length < 2) return;
  if (event.key === "ArrowLeft") showLightboxPhoto(lightboxIndex - 1);
  if (event.key === "ArrowRight") showLightboxPhoto(lightboxIndex + 1);
});

// Swipe left or right on a phone to change the photo.
let touchStartX = null;
lightbox.addEventListener("touchstart", (event) => { touchStartX = event.touches[0].clientX; }, { passive: true });
lightbox.addEventListener("touchend", (event) => {
  if (touchStartX === null || lightboxPhotos.length < 2) return;
  const distance = event.changedTouches[0].clientX - touchStartX;
  if (Math.abs(distance) > 50) showLightboxPhoto(lightboxIndex + (distance < 0 ? 1 : -1));
  touchStartX = null;
});

// Discount countdown. Checked every second, so it also works in the quick view loaded later.
const twoDigits = (number) => String(number).padStart(2, "0");
const updateCountdowns = () => {
  document.querySelectorAll("[data-countdown]").forEach((timer) => {
    const left = Math.floor((new Date(timer.dataset.countdown) - Date.now()) / 1000);
    if (left <= 0) {
      timer.textContent = timer.dataset.ended;
      timer.classList.add("ended");
      timer.removeAttribute("data-countdown");
      return;
    }
    const parts = {
      days: Math.floor(left / 86400),
      hours: twoDigits(Math.floor((left % 86400) / 3600)),
      minutes: twoDigits(Math.floor((left % 3600) / 60)),
      seconds: twoDigits(left % 60),
    };
    Object.entries(parts).forEach(([unit, value]) => {
      timer.querySelector(`[data-unit="${unit}"]`).textContent = value;
    });
  });
};
updateCountdowns();
setInterval(updateCountdowns, 1000);

// Review photo: show a small preview and the file name as soon as a photo is chosen.
document.addEventListener("change", (event) => {
  const input = event.target.closest("[data-photo-input]");
  if (!input) return;
  const field = input.closest(".photo-field");
  const preview = field.querySelector("[data-photo-preview]");
  const file = input.files[0];
  if (preview.src) URL.revokeObjectURL(preview.src);
  preview.hidden = !file;
  if (file) {
    preview.src = URL.createObjectURL(file);
    field.querySelector("[data-photo-label]").textContent = file.name;
  }
});

// Colour menu: shows the chosen colour's name, stock and photo, and limits the quantity to its stock.
const MAX_PER_ORDER = 9;
const applyColor = (input) => {
  const form = input.form;
  const picker = input.closest("[data-color-picker]");
  picker.querySelector("[data-color-name]").textContent = input.dataset.name;
  const stockCount = form.querySelector("[data-stock-count]");
  if (stockCount) stockCount.textContent = input.dataset.stock;
  const quantity = document.querySelector(`.qty-input[form="${CSS.escape(form.id)}"]`);
  if (quantity) {
    quantity.max = Math.min(Number(input.dataset.stock), MAX_PER_ORDER);
    if (Number(quantity.value) > Number(quantity.max)) quantity.value = quantity.max;
  }
  const photo = input.dataset.colorPhoto;
  const gallery = form.closest("[data-gallery]");
  if (photo && gallery) {
    gallery.querySelector("[data-main-photo]").src = photo;
    gallery.querySelectorAll("[data-photo]").forEach((thumb) => thumb.classList.toggle("active", thumb.dataset.photo === photo));
  }
};
const initColorPickers = (root) => {
  root.querySelectorAll("[data-color-picker] input:checked").forEach(applyColor);
};
document.addEventListener("change", (event) => {
  if (event.target.matches("[data-color-picker] input[name=color]")) applyColor(event.target);
});
initColorPickers(document);
