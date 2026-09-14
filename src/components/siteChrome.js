export function initSiteChrome() {

  const header =
    document.querySelector(
      '.header'
    );


  if (
    header &&
    !document.querySelector(
      '.announcement-bar'
    )
  ) {

    header.insertAdjacentHTML(
      'beforebegin',
      `

      <div
        class="announcement-bar"
      >

        <span>
          Despachos el mismo día:
          compra antes de las
          <strong>13:00 hrs.</strong>
          Recibe entre
          <strong>11:00 y 20:00 hrs.</strong>
          Para horario específico,
          consulta retiro o coordinación especial.
        </span>

      </div>

      `
    );

  }


  if (
    !document.querySelector(
      '.whatsapp-float'
    )
  ) {

    document.body.insertAdjacentHTML(
      'beforeend',
      `

      <a
        class="whatsapp-float"
        href="https://wa.me/56999685361?text=Hola%20Neni,%20tengo%20una%20consulta"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Hablar con Neni por WhatsApp"
      >

        <svg
          viewBox="0 0 32 32"
          aria-hidden="true"
        >

          <path
            d="M16 4
               a11 11 0 0 0
               -9.5 16.5
               L5 27
               l6.7 -1.7
               A11 11 0 1 0
               16 4Z"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          />

          <path
            d="M11.3 10.5
               c.5-.8 1-.8 1.4-.1
               l1.2 2
               c.2.4.1.7-.2 1
               l-.8.9
               c1.1 2.1 2.7 3.5 4.9 4.3
               l.9-1.1
               c.3-.4.6-.4 1-.2
               l2.1 1
               c.7.3.7.9.3 1.5
               -.8 1.2-2.1 1.8-3.4 1.5
               -5-1-8.8-4.5-9.9-9
               -.3-1.1.2-2.3.5-2.8Z"
            fill="currentColor"
          />

        </svg>

      </a>

      `
    );

  }

}
