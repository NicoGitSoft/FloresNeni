const STORAGE_KEY =
  'neni-cart-v1';


let catalog = [];


const clp =
  new Intl.NumberFormat(
    'es-CL',
    {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }
  );



function getCart() {

  try {

    return JSON.parse(
      localStorage.getItem(
        STORAGE_KEY
      )
    ) ?? [];

  }

  catch {

    return [];

  }

}



function saveCart(cart) {

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(cart)
  );

  renderCart();

}



export function addToCart(product) {

  const cart =
    getCart();


  const existing =
    cart.find(
      item =>
        item.id === product.id
    );


  if (existing) {

    existing.quantity += 1;

  }

  else {

    cart.push({
      id: product.id,
      quantity: 1
    });

  }


  saveCart(cart);

  openCart();

}



function updateQuantity(
  productId,
  difference
) {

  let cart =
    getCart();


  const item =
    cart.find(
      current =>
        current.id === productId
    );


  if (!item) return;


  item.quantity += difference;


  cart =
    cart.filter(
      current =>
        current.quantity > 0
    );


  saveCart(cart);

}



function removeProduct(productId) {

  const cart =
    getCart()
      .filter(
        item =>
          item.id !== productId
      );


  saveCart(cart);

}



function getDetailedCart() {

  return getCart()
    .map(item => {

      const product =
        catalog.find(
          candidate =>
            candidate.id === item.id
        );


      if (!product) {
        return null;
      }


      return {

        ...product,

        quantity:
          item.quantity

      };

    })
    .filter(Boolean);

}



function renderCart() {

  const items =
    getDetailedCart();


  const count =
    items.reduce(
      (total, item) =>
        total +
        item.quantity,
      0
    );


  const subtotal =
    items.reduce(
      (total, item) =>
        total +
        (
          item.price *
          item.quantity
        ),
      0
    );


  document
    .querySelectorAll(
      '.cart-count'
    )
    .forEach(counter => {

      counter.textContent =
        String(count);

    });


  const content =
    document.querySelector(
      '#cart-content'
    );


  const total =
    document.querySelector(
      '#cart-total'
    );


  if (!content || !total) {
    return;
  }


  if (
    items.length === 0
  ) {

    content.innerHTML = `

      <div class="cart-empty">

        <p>
          Tu carrito está vacío.
        </p>

        <span>
          Todavía no has elegido flores.
        </span>

      </div>

    `;

  }

  else {

    content.innerHTML =
      items.map(item => `

        <article
          class="cart-item"
        >

          <img
            src="${item.images[0]}"
            alt="${item.name}"
          >


          <div
            class="cart-item__content"
          >

            <h3>
              ${item.name}
            </h3>

            <span>
              ${clp.format(item.price)}
            </span>


            <div
              class="cart-item__quantity"
            >

              <button
                data-cart-minus="${item.id}"
                aria-label="Quitar una unidad"
              >
                −
              </button>


              <strong>
                ${item.quantity}
              </strong>


              <button
                data-cart-plus="${item.id}"
                aria-label="Agregar una unidad"
              >
                +
              </button>

            </div>


            <button
              class="cart-item__remove"
              data-cart-remove="${item.id}"
            >
              Eliminar
            </button>

          </div>

        </article>

      `).join('');

  }


  total.textContent =
    clp.format(subtotal);

}



export function openCart() {

  document
    .querySelector(
      '#cart-drawer'
    )
    ?.classList
    .add('is-open');


  document
    .querySelector(
      '#cart-backdrop'
    )
    ?.classList
    .add('is-open');


  document.body.classList.add(
    'cart-open'
  );

}



export function closeCart() {

  document
    .querySelector(
      '#cart-drawer'
    )
    ?.classList
    .remove('is-open');


  document
    .querySelector(
      '#cart-backdrop'
    )
    ?.classList
    .remove('is-open');


  document.body.classList.remove(
    'cart-open'
  );

}



function checkoutWhatsApp() {

  const items =
    getDetailedCart();


  if (
    items.length === 0
  ) {
    return;
  }


  const subtotal =
    items.reduce(
      (total, item) =>
        total +
        item.price *
        item.quantity,
      0
    );


  const lines =
    items.map(
      item =>
        `• ${item.quantity} × ${item.name} — ${clp.format(
          item.price *
          item.quantity
        )}`
    );


  const message = [

    'Hola Neni 🌷',
    '',
    'Quiero hacer este pedido:',
    '',
    ...lines,
    '',
    `Subtotal: ${clp.format(subtotal)}`,
    '',
    '¿Podemos coordinar disponibilidad y despacho?'

  ].join('\n');


  window.open(
    `https://wa.me/56999685361?text=${encodeURIComponent(
      message
    )}`,
    '_blank',
    'noopener,noreferrer'
  );

}



export function initCart(products) {

  catalog = products;


  if (
    !document.querySelector(
      '#cart-drawer'
    )
  ) {

    document.body.insertAdjacentHTML(
      'beforeend',
      `

      <div
        id="cart-backdrop"
        class="cart-backdrop"
      ></div>


      <aside
        id="cart-drawer"
        class="cart-drawer"
        aria-label="Carrito"
      >

        <div class="cart-drawer__header">

          <div>

            <p class="section-label">
              Tu selección
            </p>

            <h2>
              Carrito
            </h2>

          </div>


          <button
            id="cart-close"
            class="cart-drawer__close"
            aria-label="Cerrar carrito"
          >
            ×
          </button>

        </div>


        <div
          id="cart-content"
          class="cart-drawer__content"
        ></div>


        <div
          class="cart-drawer__footer"
        >

          <div
            class="cart-subtotal"
          >

            <span>
              Subtotal
            </span>

            <strong
              id="cart-total"
            >
              $0
            </strong>

          </div>


          <p>
            Despacho se calcula
            al confirmar el pedido.
          </p>


          <button
            id="cart-checkout"
            class="button button--dark cart-checkout"
          >
            Finalizar por WhatsApp
          </button>


          <small>
            WebPay se integrará en
            la etapa de checkout.
          </small>

        </div>

      </aside>

      `
    );

  }


  document
    .querySelector('.cart-button')
    ?.addEventListener(
      'click',
      openCart
    );


  document
    .querySelector('#cart-close')
    ?.addEventListener(
      'click',
      closeCart
    );


  document
    .querySelector('#cart-backdrop')
    ?.addEventListener(
      'click',
      closeCart
    );


  document
    .querySelector('#cart-checkout')
    ?.addEventListener(
      'click',
      checkoutWhatsApp
    );


  document.addEventListener(
    'click',
    event => {


      const plus =
        event.target.closest(
          '[data-cart-plus]'
        );


      if (plus) {

        updateQuantity(
          plus.dataset.cartPlus,
          1
        );

        return;

      }


      const minus =
        event.target.closest(
          '[data-cart-minus]'
        );


      if (minus) {

        updateQuantity(
          minus.dataset.cartMinus,
          -1
        );

        return;

      }


      const remove =
        event.target.closest(
          '[data-cart-remove]'
        );


      if (remove) {

        removeProduct(
          remove.dataset.cartRemove
        );

      }


    }
  );


  renderCart();

}
