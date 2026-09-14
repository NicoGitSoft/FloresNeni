import {
  addToCart
} from './cart.js';


import {
  applyImageTone
} from '../utils/imageTone.js';


const clp =
  new Intl.NumberFormat(
    'es-CL',
    {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }
  );



export function renderProducts(
  products
) {

  const grid =
    document.querySelector(
      '#product-grid'
    );


  if (!grid) return;


  grid.innerHTML =
    products.map(product => `

      <article
        class="product-card"
      >

        <button
          class="product-card__image"
          data-product="${product.id}"
          aria-label="Ver ${product.name}"
        >

          <img
            src="${product.images[0]}"
            alt="${product.name}"
            loading="lazy"
          >


          ${
            product.images.length > 1
              ?
                `
                <span
                  class="product-card__photos"
                >
                  ${product.images.length} fotos
                </span>
                `
              :
                ''
          }

        </button>


        <div
          class="product-card__info"
        >

          <div>

            <h3>
              ${product.name}
            </h3>

            <p>
              ${product.composition}
            </p>

          </div>


          <strong>
            ${clp.format(
              product.price
            )}
          </strong>

        </div>

      </article>

    `).join('');


  grid.addEventListener(
    'click',
    event => {


      const button =
        event.target.closest(
          '[data-product]'
        );


      if (!button) {
        return;
      }


      const product =
        products.find(
          item =>
            item.id ===
            button.dataset.product
        );


      if (product) {
        openProduct(product);
      }

    }
  );

}



function openProduct(product) {

  let dialog =
    document.querySelector(
      '#product-dialog'
    );


  if (!dialog) {

    dialog =
      document.createElement(
        'dialog'
      );


    dialog.id =
      'product-dialog';


    dialog.className =
      'product-dialog';


    document.body.appendChild(
      dialog
    );

  }


  dialog.innerHTML = `

    <button
      class="product-dialog__close"
      aria-label="Cerrar"
    >
      ×
    </button>


    <div
      class="product-dialog__gallery"
    >

      <img
        id="dialog-main-image"
        src="${product.images[0]}"
        alt="${product.name}"
      >


      ${
        product.images.length > 1
          ?
            `
            <div
              class="product-dialog__thumbs"
            >

              ${product.images.map(
                (image, index) => `

                <button
                  data-gallery-image="${image}"
                  aria-label="Ver imagen ${index + 1}"
                >

                  <img
                    src="${image}"
                    alt=""
                  >

                </button>

              `
              ).join('')}

            </div>
            `
          :
            ''
      }

    </div>


    <div
      class="product-dialog__content"
    >

      <p class="section-label">
        Neni · Taller de Flores
      </p>


      <h2>
        ${product.name}
      </h2>


      <p
        class="product-dialog__composition"
      >
        ${product.composition}
      </p>


      <p
        class="product-dialog__description"
      >
        ${product.description}
      </p>


      ${
        product.variable
          ?
            `
            <p
              class="product-dialog__note"
            >
              La fotografía es referencial.
              Algunas flores, follajes o
              envoltorios pueden variar
              según disponibilidad.
            </p>
            `
          :
            ''
      }


      <strong
        class="product-dialog__price"
      >
        ${clp.format(
          product.price
        )}
      </strong>


      <button
        class="button button--dark"
        id="dialog-add-cart"
      >
        Quiero este ramo
      </button>

    </div>

  `;


  const mainImage =
    dialog.querySelector(
      '#dialog-main-image'
    );


  applyImageTone(
    dialog,
    mainImage
  );


  dialog
    .querySelector(
      '.product-dialog__close'
    )
    .addEventListener(
      'click',
      () =>
        dialog.close()
    );


  dialog
    .querySelector(
      '#dialog-add-cart'
    )
    .addEventListener(
      'click',
      () => {

        addToCart(product);

        dialog.close();

      }
    );


  dialog
    .querySelectorAll(
      '[data-gallery-image]'
    )
    .forEach(button => {


      button.addEventListener(
        'click',
        () => {


          mainImage.src =
            button.dataset.galleryImage;


          applyImageTone(
            dialog,
            mainImage
          );


        }
      );


    });


  dialog.showModal();

}