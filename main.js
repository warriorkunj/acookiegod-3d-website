import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initCursor();
    initSmoothScroll();
    initScrollReveal();
    initParallaxEffects();
});

// ============================================
// CUSTOM CURSOR
// ============================================
function initCursor() {
    const cursor = document.getElementById('cursor');
    const cursorText = cursor.querySelector('.cursor-text');
    const mouse = { x: 0, y: 0 };
    const cursorPos = { x: 0, y: 0 };
    const defaultSize = 32;
    const hoverSize = 64;

    // Follow mouse
    document.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    // Lerp cursor position
    function animateCursor() {
        cursorPos.x += (mouse.x - cursorPos.x) * 0.15;
        cursorPos.y += (mouse.y - cursorPos.y) * 0.15;
        cursor.style.left = cursorPos.x - cursor.offsetWidth / 2 + 'px';
        cursor.style.top = cursorPos.y - cursor.offsetHeight / 2 + 'px';
        requestAnimationFrame(animateCursor);
    }
    animateCursor();

    // Hover states
    const interactiveElements = document.querySelectorAll(
        'a, button, .nav-link, .pill, .drop-card, .cta-button'
    );

    interactiveElements.forEach(el => {
        const originalBorder = el.style.border;
        const originalBg = el.style.background;

        el.addEventListener('mouseenter', () => {
            cursor.classList.add('hover');
            cursorText.textContent = getCursorText(el);
            cursor.style.width = hoverSize + 'px';
            cursor.style.height = hoverSize + 'px';
            cursor.style.background = 'rgba(0, 242, 254, 0.15)';
            cursor.style.border = '1px solid var(--color-cyan)';
        });

        el.addEventListener('mouseleave', () => {
            cursor.classList.remove('hover');
            cursor.style.width = defaultSize + 'px';
            cursor.style.height = defaultSize + 'px';
            cursor.style.background = 'radial-gradient(circle at 30% 30%, var(--color-cyan), var(--color-coral))';
            cursor.style.border = 'none';
        });
    });
}

function getCursorText(el) {
    if (el.classList.contains('pill')) return 'CLICK';
    if (el.classList.contains('cta-button')) return 'ENTER';
    if (el.classList.contains('nav-link')) return 'EXPLORE';
    if (el.className.includes('drop-card')) return 'VIEW';
    return '';
}

// ============================================
// SMOOTH SCROLL (Lenis-inspired)
// ============================================
function initSmoothScroll() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    // GSAP smooth scroller
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (!targetElement) return;

            const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
            const startPosition = window.pageYOffset;
            const distance = targetPosition - startPosition;
            const duration = Math.abs(distance) / 1000 * 1200; // ~1.2s min
            const easedDistance = distance;

            gsap.to(window, {
                scroll: {
                    y: startPosition + easedDistance,
                    autoKill: true,
                },
                duration: Math.max(1200, duration),
                ease: 'power3.inOut',
                overwrite: 'auto',
            });
        });
    });
}

// ============================================
// SCROLL REVEAL ANIMATIONS
// ============================================
function initScrollReveal() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    // Observe and reveal elements on scroll
    const revealElements = document.querySelectorAll(
        '.drop-card, .nav-link, .social-pills .pill, .hero-main-title .span'
    );

    const revealObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const delay = parseFloat(el.getAttribute('data-delay')) || 0;

                    setTimeout(() => {
                        el.style.opacity = '1';
                        el.style.transform = 'translateY(0)';
                    }, delay);
                    revealObserver.unobserve(el);
                }
            }, {
                threshold: 0.15,
                rootMargin: '0px 0px -50px 0px',
            });
        },
        revealElements
    );

    // Set initial states and observe
    revealElements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.transitionDelay = `${index * 0.1}s`;
        revealObserver.observe(el);
    });
}

// ============================================
// PARALLAX EFFECTS
// ============================================
function initParallaxEffects() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    // Video background subtle parallax
    const videoBg = document.querySelector('.video-bg video');

    if (videoBg) {
        document.addEventListener('mousemove', (e) => {
            const xPercent = (e.clientX / window.innerWidth - 0.5) * 20;
            const yPercent = (e.clientY / window.innerHeight - 0.5) * 20;
            videoBg.style.transform = `translate(${xPercent}px, ${yPercent}px)`;
        });
    }

    // Header subtle move on mouse move
    const header = document.querySelector('nav');
    if (header) {
        document.addEventListener('mousemove', (e) => {
            const xPercent = (e.clientX / window.innerWidth - 0.5) * 2;
            header.style.transform = `translateX(${xPercent}px)`;
        });
    }
}

// ============================================
// ACTIVE NAVIGATION HIGHLIGHT
// ============================================
function initActiveNav() {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-link');

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    navLinks.forEach((link) => link.classList.remove('active-nav'));
                    if (navLinks[index]) {
                        navLinks[index].classList.add('active-nav');
                    }
                }
            });
        }, {
        threshold: 0.5,
        rootMargin: '-20% 0% -80% 0%',
    }
    );

    sections.forEach((section) => {
        observer.observe(section);
    });
}

// Initialize active nav on load
setTimeout(initActiveNav, 500);