import './styles/tokens.css';
import './styles/global.css';
import './styles/hero.css';
import './styles/products.css';
import './styles/brand.css';
import './styles/ui.css';


import {
  gsap
} from 'gsap';


import {
  products
} from './data/products.js';


import {
  renderProducts
} from './components/products.js';


import {
  initCart
} from './components/cart.js';


import {
  initSiteChrome
} from './components/siteChrome.js';


import {
  applyImageTone
} from './utils/imageTone.js';



console.log(
  '🌸 FloresNeni iniciado'
);



/* =====================================================
   SITE
===================================================== */

initSiteChrome();

initCart(
  products
);

renderProducts(
  products
);



/* =====================================================
   COLORES DINÁMICOS
===================================================== */

const heroContainer =
  document.querySelector(
    '.hero__image-placeholder'
  );


const heroImage =
  heroContainer
    ?.querySelector('img');


if (
  heroContainer &&
  heroImage
) {

  applyImageTone(
    heroContainer,
    heroImage
  );

}



const experience =
  document.querySelector(
    '.experience'
  );


const experienceImage =
  experience
    ?.querySelector(
      '.experience__logo img'
    );


if (
  experience &&
  experienceImage
) {

  applyImageTone(
    experience,
    experienceImage
  );

}



/* =====================================================
   HERO
===================================================== */

gsap.from(
  '.hero__content > *',
  {

    opacity: 0,

    y: 24,

    duration: 1,

    stagger: 0.12,

    ease:
      'power2.out'

  }
);



gsap.from(
  '.hero__brand-center',
  {

    opacity: 0,

    scale: .95,

    duration: 1.3,

    ease:
      'power2.out'

  }
);



/* =====================================================
   BRISA
===================================================== */

const leaves =
  document.querySelectorAll(
    '.botanical-leaf'
  );


window.addEventListener(
  'pointermove',
  event => {


    const x =
      event.clientX /
      window.innerWidth -
      .5;


    const y =
      event.clientY /
      window.innerHeight -
      .5;


    leaves.forEach(
      (leaf, index) => {


        const multiplier =
          index === 0
            ? 1
            : -1;


        gsap.to(
          leaf,
          {

            x:
              x *
              12 *
              multiplier,

            y:
              y *
              8,

            rotation:
              x *
              3 *
              multiplier,

            duration:
              1.25,

            ease:
              'power3.out',

            overwrite:
              true

          }
        );


      }
    );

  }
);