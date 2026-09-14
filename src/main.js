import './styles/tokens.css';
import './styles/global.css';
import './styles/hero.css';
import './styles/products.css';

import { gsap } from 'gsap';

import { products } from './data/products.js';
import { renderProducts } from './components/products.js';

console.log('🌸 FloresNeni iniciado');

renderProducts(products);


gsap.from('.hero__content > *', {
  opacity: 0,
  y: 24,
  duration: 1,
  stagger: 0.12,
  ease: 'power2.out'
});


gsap.from('.hero__image-placeholder', {
  opacity: 0,
  scale: 0.98,
  duration: 1.2,
  ease: 'power2.out'
});


const leaves =
  document.querySelectorAll('.botanical-leaf');


window.addEventListener(
  'pointermove',
  (event) => {

    const x =
      event.clientX /
      window.innerWidth -
      0.5;

    const y =
      event.clientY /
      window.innerHeight -
      0.5;


    leaves.forEach(
      (leaf, index) => {

        const multiplier =
          index === 0
            ? 1
            : -1;

        gsap.to(
          leaf,
          {
            x: x * 12 * multiplier,
            y: y * 8,
            rotation: x * 3 * multiplier,
            duration: 1.3,
            ease: 'power3.out',
            overwrite: true
          }
        );

      }
    );

  }
);