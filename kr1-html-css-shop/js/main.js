(() => {
  'use strict';

  const PRODUCTS = window.PRODUCTS || [];
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const rub = (n) => n.toLocaleString('ru-RU') + '\u00a0₽';
  const byId = (id) => PRODUCTS.find((p) => p.id === id);
  const plural = (n, f) => {
    const a = n % 10, b = n % 100;
    return `${n} ${a === 1 && b !== 11 ? f[0] : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? f[1] : f[2]}`;
  };
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
  };

  const favs = new Set(store.get('shop:favs', []));

  // ================= КАРТОЧКИ ТОВАРОВ =================
  const stars = (r) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));

  function stockLabel(p) {
    if (p.stock === 0) return '<span class="stock stock--out">Нет в наличии</span>';
    if (p.stock <= 10) return `<span class="stock stock--low">Осталось ${p.stock} шт.</span>`;
    return '<span class="stock stock--in">В наличии</span>';
  }

  function cardHTML(p) {
    const fav = favs.has(p.id);
    const discount = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    return `
    <article class="product-card product-card--clickable${p.stock === 0 ? ' product-card--out' : ''}" data-id="${p.id}">
      <div class="product-card__media">
        <img class="product-card__img" src="${p.image}" alt="${p.alt}" width="400" height="300" loading="lazy">
        <div class="product-card__badges">
          ${p.tags.includes('new') ? '<span class="product-badge product-badge--new">Новинка</span>' : ''}
          ${discount ? `<span class="product-badge product-badge--sale">−${discount}%</span>` : ''}
        </div>
        <button type="button" class="product-card__fav" data-fav="${p.id}" aria-pressed="${fav}"
                aria-label="${fav ? 'Убрать из избранного' : 'Добавить в избранное'}: ${p.name}">♥</button>
      </div>
      <div class="product-card__body">
        <p class="product-card__kind">${p.kind}</p>
        <h3 class="product-card__title">${p.name}</h3>
        <p class="product-card__rating"><span aria-hidden="true">${stars(p.rating)}</span>
          <span class="visually-hidden">Рейтинг ${p.rating} из 5.</span> ${p.rating} · ${plural(p.reviews, ['отзыв', 'отзыва', 'отзывов'])}</p>
        <p class="product-card__short-desc">${p.short}</p>
        ${stockLabel(p)}
        <div class="product-card__footer">
          <p class="product-card__price-block">
            ${p.oldPrice ? `<s class="product-card__price--old">${rub(p.oldPrice)}</s>` : ''}
            <span class="product-card__price">${rub(p.price)}</span>
          </p>
          <button class="button" type="button" aria-label="Подробнее: ${p.name}">${p.stock === 0 ? 'Узнать о поступлении' : 'Подробнее'}</button>
        </div>
      </div>
    </article>`;
  }

  function toggleFav(btn) {
    const id = btn.dataset.fav;
    const on = !favs.has(id);
    on ? favs.add(id) : favs.delete(id);
    store.set('shop:favs', [...favs]);
    const p = byId(id);
    $$(`[data-fav="${id}"]`).forEach((b) => {
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', `${on ? 'Убрать из избранного' : 'Добавить в избранное'}: ${p.name}`);
    });
    toast(on ? `«${p.name}» добавлен в избранное` : `«${p.name}» убран из избранного`);
  }

  // ================= КАТАЛОГ И ГЛАВНАЯ =================
  function initCatalog() {
    const grid = $('[data-products="catalog"]');
    if (!grid) return;
    const form = $('#catalog-filters-form');
    const count = $('#catalog-count');
    const empty = $('#catalog-empty');

    const apply = () => {
      const fd = new FormData(form);
      const cats = fd.getAll('category');
      const from = parseFloat(fd.get('price-from'));
      const to = parseFloat(fd.get('price-to'));
      const list = PRODUCTS.filter((p) =>
        (!cats.length || cats.some((c) => p.tags.includes(c))) &&
        (isNaN(from) || p.price >= from) && (isNaN(to) || p.price <= to));
      const sorters = {
        popular: (a, b) => b.reviews - a.reviews,
        'price-asc': (a, b) => a.price - b.price,
        'price-desc': (a, b) => b.price - a.price,
        new: (a, b) => b.date.localeCompare(a.date)
      };
      list.sort(sorters[fd.get('sort')] || sorters.popular);
      grid.innerHTML = list.map(cardHTML).join('');
      count.textContent = `Показано: ${plural(list.length, ['товар', 'товара', 'товаров'])}`;
      empty.hidden = list.length > 0;
    };

    form.addEventListener('submit', (e) => { e.preventDefault(); apply(); });
    form.addEventListener('change', apply);
    form.addEventListener('reset', () => setTimeout(apply));
    apply();
  }

  function initPopular() {
    $$('[data-products="popular"]').forEach((el) => {
      const limit = Number(el.dataset.limit) || 4;
      el.innerHTML = PRODUCTS.filter((p) => p.tags.includes('popular')).slice(0, limit).map(cardHTML).join('');
    });
  }

  // ================= ТОСТ =================
  let toastTimer;
  function toast(text) {
    const box = $('#site-toast');
    if (!box) return;
    box.textContent = text;
    box.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('is-visible'), 4000);
  }

  // ================= МОДАЛЬНОЕ ОКНО =================
  const field = (id, label, attrs, hint = '') => `
    <div class="order-form__field">
      <label class="order-form__label" for="${id}">${label}${attrs.includes('required') ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>
      <input class="order-form__input" id="${id}" ${attrs} aria-describedby="${hint ? id + '-hint ' : ''}${id}-error">
      ${hint ? `<small class="order-form__hint" id="${id}-hint">${hint}</small>` : ''}
      <span class="order-form__error" id="${id}-error" aria-live="polite"></span>
    </div>`;

  function buildDialog() {
    if ($('#order-dialog')) return;
    document.body.insertAdjacentHTML('beforeend', `
    <dialog class="order-dialog" id="order-dialog" aria-labelledby="order-dialog-title">
      <button type="button" class="order-dialog__close-icon" data-close aria-label="Закрыть окно">&times;</button>
      <ol class="order-steps" aria-label="Шаги заявки">
        <li class="order-steps__item is-current" id="step-1" aria-current="step">Описание</li>
        <li class="order-steps__item" id="step-2">Заявка</li>
      </ol>
      <h2 class="order-dialog__title" id="order-dialog-title" tabindex="-1">Описание товара</h2>

      <div class="order-dialog__product-info" id="dialog-product-info">
        <img class="order-dialog__image" id="dialog-image" alt="" width="400" height="300">
        <p class="order-dialog__rating" id="dialog-rating"></p>
        <p class="order-dialog__product-desc" id="dialog-product-desc"></p>
        <ul class="order-dialog__features" id="dialog-features"></ul>
        <table class="specs-table specs-table--compact" id="dialog-specs">
          <caption class="visually-hidden">Характеристики</caption><tbody></tbody>
        </table>
        <p class="order-dialog__product-price" id="dialog-product-price"></p>
        <div class="order-dialog__actions">
          <button type="button" class="btn btn--primary" id="open-form-button">Заказать этот товар</button>
          <button type="button" class="btn btn--secondary" data-close>Закрыть</button>
        </div>
      </div>

      <form class="order-form" id="order-form" action="#" method="post" novalidate hidden>
        <p class="order-form__note">Поля, отмеченные <span class="req" aria-hidden="true">*</span> (звёздочкой), обязательны для заполнения.</p>
        <div class="order-form__summary" id="form-summary" role="alert" tabindex="-1" hidden></div>
        <input id="selected-product" name="selected-product" type="hidden">

        <fieldset class="order-form__group" id="qty-group">
          <legend>Ваш заказ</legend>
          <p class="order-form__chosen" id="chosen-product"></p>
          <div class="order-form__field">
            <label class="order-form__label" for="order-qty">Количество</label>
            <div class="qty">
              <button type="button" class="qty__btn" data-qty="-1" aria-label="Уменьшить количество">−</button>
              <input class="order-form__input qty__input" id="order-qty" name="quantity" type="number" min="1" max="10" value="1" inputmode="numeric">
              <button type="button" class="qty__btn" data-qty="1" aria-label="Увеличить количество">+</button>
            </div>
            <p class="order-form__total">Итого: <output id="order-total" for="order-qty"></output></p>
          </div>
        </fieldset>

        <fieldset class="order-form__group">
          <legend>Контакты</legend>
          ${field('order-name', 'Имя', 'name="name" type="text" required autocomplete="name"')}
          ${field('order-email', 'E-mail', 'name="email" type="email" required autocomplete="email"')}
          ${field('order-phone', 'Телефон', 'name="phone" type="tel" inputmode="tel" required autocomplete="tel" placeholder="+7 (900) 000-00-00"', 'Формат: +7 (900) 000-00-00')}
        </fieldset>

        <fieldset class="order-form__group">
          <legend>Детали</legend>
          ${field('order-date', 'Дата связи', 'name="date" type="date"')}
          <div class="order-form__field">
            <label class="order-form__label" for="order-topic">Тема заявки <span class="req" aria-hidden="true">*</span></label>
            <select class="order-form__select" id="order-topic" name="topic" required aria-describedby="order-topic-error">
              <option value="">Выберите тему</option>
              <option value="product">Заказ товара</option>
              <option value="consultation">Консультация</option>
              <option value="delivery">Доставка</option>
            </select>
            <span class="order-form__error" id="order-topic-error" aria-live="polite"></span>
          </div>
          <div class="order-form__field">
            <label class="order-form__label" for="order-comment">Комментарий</label>
            <textarea class="order-form__textarea" id="order-comment" name="comment" rows="3" maxlength="300"
                      placeholder="Укажите дополнительную информацию" aria-describedby="order-comment-hint"></textarea>
            <small class="order-form__hint" id="order-comment-hint"><span id="comment-count">0</span> / 300 символов</small>
          </div>
        </fieldset>

        <div class="order-form__field order-form__field--checkbox">
          <label class="order-form__checkbox-label">
            <input id="order-agreement" name="agreement" type="checkbox" required aria-describedby="order-agreement-error">
            <span>Я согласен на обработку данных <span class="req" aria-hidden="true">*</span></span>
          </label>
          <span class="order-form__error" id="order-agreement-error" aria-live="polite"></span>
        </div>

        <p class="order-form__hint" id="draft-note">Введённые данные сохраняются как черновик на этом устройстве.</p>
        <div class="order-form__actions">
          <button type="button" class="btn btn--secondary" id="close-order-dialog">Назад к описанию</button>
          <button type="submit" class="btn btn--primary">Отправить заявку</button>
        </div>
      </form>
    </dialog>
    <div class="toast" id="site-toast" role="status" aria-live="polite"></div>`);
  }

  function initDialog() {
    buildDialog();
    const dlg = $('#order-dialog');
    const info = $('#dialog-product-info');
    const form = $('#order-form');
    const title = $('#order-dialog-title');
    const qty = $('#order-qty');
    const total = $('#order-total');
    const summary = $('#form-summary');
    const phone = $('#order-phone');
    const openBtn = $('#open-form-button');
    let current = null; // выбранный товар
    let customLabel = ''; // название тарифа/темы, если нет товара

    const FIELDS = ['order-name', 'order-email', 'order-phone', 'order-topic', 'order-comment'];
    const DRAFT = 'shop:draft';

    // ---- шаги ----
    const showStep = (n) => {
      info.hidden = n !== 1;
      form.hidden = n !== 2;
      $('#step-1').classList.toggle('is-current', n === 1);
      $('#step-2').classList.toggle('is-current', n === 2);
      $('#step-1').toggleAttribute('aria-current', n === 1);
      $('#step-2').toggleAttribute('aria-current', n === 2);
      $('#step-1').classList.toggle('is-done', n === 2);
      if (n === 2) {
        title.textContent = current ? `Заявка: ${current.name}` : (customLabel || 'Оставить заявку');
        restoreDraft();
        if (current && !$('#order-topic').value) $('#order-topic').value = 'product';
        $('#order-name').focus();
      } else if (current) {
        title.textContent = current.name;
      }
    };

    const updateTotal = () => {
      const q = Math.min(Math.max(parseInt(qty.value, 10) || 1, 1), Number(qty.max) || 10);
      total.textContent = current ? rub(current.price * q) : '';
      total.parentElement.hidden = !current;
    };

    // ---- открытие ----
    function open({ id, label, form: formFirst } = {}) {
      current = (id && byId(id)) || null;
      customLabel = label || '';
      $('#selected-product').value = current ? current.name : customLabel;
      $('#qty-group').hidden = !current;
      qty.value = 1;
      qty.max = current ? Math.min(10, current.stock || 10) : 10;
      clearErrors();

      if (current) {
        $('#dialog-image').src = current.image;
        $('#dialog-image').alt = current.alt;
        $('#dialog-image').hidden = false;
        $('#dialog-rating').textContent = `${stars(current.rating)} ${current.rating} · ${plural(current.reviews, ['отзыв', 'отзыва', 'отзывов'])}`;
        $('#dialog-product-desc').textContent = current.desc;
        $('#dialog-features').innerHTML = current.features.map((f) => `<li>${f}</li>`).join('');
        $('#dialog-specs tbody').innerHTML = current.specs.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('');
        $('#dialog-product-price').textContent = `Цена: ${rub(current.price)}`;
        openBtn.textContent = current.stock === 0 ? 'Сообщить о поступлении' : 'Заказать этот товар';
        $('#chosen-product').textContent = `${current.name} — ${rub(current.price)}`;
        if (current.stock === 0) $('#order-topic').value = 'consultation';
        history.replaceState(null, '', `${location.pathname}${location.search}#product-${current.id}`);
        updateTotal();
      }
      if (!dlg.open) dlg.showModal();
      if (current && !formFirst) showStep(1); else showStep(2);
      document.documentElement.classList.add('is-locked');
    }

    // ---- закрытие ----
    dlg.addEventListener('close', () => {
      document.documentElement.classList.remove('is-locked');
      if (location.hash.startsWith('#product-')) history.replaceState(null, '', location.pathname + location.search);
    });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) {
        const r = dlg.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
      }
      if (e.target.closest('[data-close]')) dlg.close();
    });
    openBtn.addEventListener('click', () => showStep(2));
    $('#close-order-dialog').addEventListener('click', () => { showStep(current ? 1 : 2); if (current) openBtn.focus(); });

    // ---- количество ----
    $$('[data-qty]', dlg).forEach((b) => b.addEventListener('click', () => {
      qty.value = Math.min(Math.max((parseInt(qty.value, 10) || 1) + Number(b.dataset.qty), 1), Number(qty.max));
      updateTotal();
    }));
    qty.addEventListener('input', updateTotal);

    // ---- маска телефона ----
    phone.addEventListener('input', (e) => {
      let d = e.target.value.replace(/\D/g, '');
      if (d.startsWith('7') || d.startsWith('8')) d = d.slice(1);
      let s = '+7 ';
      if (d.length > 0) s += '(' + d.slice(0, 3);
      if (d.length >= 4) s += ') ' + d.slice(3, 6);
      if (d.length >= 7) s += '-' + d.slice(6, 8);
      if (d.length >= 9) s += '-' + d.slice(8, 10);
      e.target.value = d.length ? s : '';
    });

    // ---- счётчик комментария ----
    const comment = $('#order-comment');
    comment.addEventListener('input', () => { $('#comment-count').textContent = comment.value.length; });

    // ---- минимальная дата ----
    const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    $('#order-date').min = today.toISOString().slice(0, 10);

    // ---- черновик ----
    function restoreDraft() {
      const d = store.get(DRAFT, {});
      FIELDS.forEach((id) => { const el = $('#' + id); if (d[id] && !el.value) el.value = d[id]; });
      $('#comment-count').textContent = comment.value.length;
    }
    form.addEventListener('input', () => {
      const d = {};
      FIELDS.forEach((id) => { d[id] = $('#' + id).value; });
      store.set(DRAFT, d);
    });

    // ---- валидация ----
    function errorFor(el) {
      if (el.validity.valueMissing) return el.type === 'checkbox' ? 'Подтвердите согласие на обработку данных' : 'Заполните это поле';
      if (el.validity.typeMismatch) return 'Проверьте e-mail: пример name@example.com';
      if (el.id === 'order-phone' && el.value.length < 18) return 'Введите номер телефона полностью';
      if (el.validity.rangeUnderflow) return 'Дата не может быть в прошлом';
      return '';
    }
    function check(el) {
      const msg = errorFor(el);
      const out = $('#' + el.id + '-error');
      if (out) out.textContent = msg;
      msg ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid');
      return !msg;
    }
    function clearErrors() {
      $$('.order-form__error', form).forEach((s) => { s.textContent = ''; });
      $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
      summary.hidden = true;
    }
    const checkable = () => $$('input, select, textarea', form).filter((el) => el.willValidate && el.type !== 'hidden' && $('#' + el.id + '-error'));
    form.addEventListener('focusout', (e) => { if (e.target.willValidate && $('#' + e.target.id + '-error')) check(e.target); });
    form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid')) check(e.target); });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const bad = checkable().filter((el) => !check(el));
      if (bad.length) {
        summary.hidden = false;
        summary.textContent = `Исправьте ${plural(bad.length, ['поле', 'поля', 'полей'])}: ${bad.map((el) => $(`label[for="${el.id}"]`)?.firstChild.textContent.trim() || (el.id === 'order-agreement' ? 'Согласие' : el.name)).join(', ')}.`;
        summary.focus();
        return;
      }
      const name = $('#order-name').value.trim();
      const product = $('#selected-product').value;
      store.del(DRAFT);
      form.reset();
      dlg.close();
      toast(`Спасибо, ${name}! Заявка${product ? ` «${product}»` : ''} отправлена.`);
    });

    // ---- точки входа: любая страница, любой элемент ----
    document.addEventListener('click', (e) => {
      const fav = e.target.closest('[data-fav]');
      if (fav) { toggleFav(fav); return; }
      const trigger = e.target.closest('[data-open-order]');
      if (trigger) { e.preventDefault(); open({ form: true, label: trigger.dataset.plan ? `Тариф «${trigger.dataset.plan}»` : '' }); return; }
      const card = e.target.closest('.product-card[data-id]');
      if (card) open({ id: card.dataset.id });
    });

    const m = location.hash.match(/^#product-(.+)$/);
    if (m && byId(m[1])) open({ id: m[1] });
    else if (new URLSearchParams(location.search).has('order')) open({ form: true });
  }

  // ================= КНОПКА «НАВЕРХ» =================
  function initToTop() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'to-top';
    btn.setAttribute('aria-label', 'Наверх');
    btn.innerHTML = '<span aria-hidden="true">↑</span>';
    document.body.append(btn);
    const update = () => btn.classList.toggle('is-visible', window.scrollY > 400);
    window.addEventListener('scroll', update, { passive: true });
    btn.addEventListener('click', () => {
      const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
      $('a, button')?.focus({ preventScroll: true });
    });
    update();
  }

  // ================= АКТИВНЫЙ ПУНКТ МЕНЮ =================
  function markCurrentPage() {
    const page = location.pathname.split('/').pop() || 'index.html';
    $$('.site-nav__list a').forEach((a) => {
      if (a.getAttribute('href') === page) a.setAttribute('aria-current', 'page');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    markCurrentPage();
    initPopular();
    initCatalog();
    initDialog();
    initToTop();
  });
})();
