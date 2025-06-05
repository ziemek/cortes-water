// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Website loaded successfully!');
    
    // Example of adding dynamic content
    const content = document.querySelector('.content');
    
    // Add a button to demonstrate JavaScript functionality
    const button = document.createElement('button');
    button.textContent = 'Click me!';
    button.style.marginTop = '1rem';
    button.addEventListener('click', () => {
        alert('Button clicked! Add your custom functionality here.');
    });
    
    content.appendChild(button);
}); 