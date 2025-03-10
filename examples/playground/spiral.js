// Colorful Spiral
// This example draws a spiral with changing colors

// Set up the drawing
goto(0,0);
speed(8);
pensize(2);
pendown();

// Define colors for the spiral
const colors = ["red", "orange", "yellow", "green", "blue", "indigo", "violet"];

// Create the spiral
let size = 5;
for (let i = 0; i < 60; i++) {
    // Change color every few steps
    pencolor(colors[i % colors.length]);

    forward(size);
    right(30);

    // Increase size slightly with each iteration
    size += 1.5;
}

// Finish with a dot
dot(20, "purple");