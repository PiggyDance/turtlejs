// Colorful Spiral
// This example draws a spiral with changing colors

// Set up the drawing
await t.goto(0,0);
await t.speed(8);
await t.pensize(2);
await t.pendown();

// Define colors for the spiral
const colors = ["red", "orange", "yellow", "green", "blue", "indigo", "violet"];

// Create the spiral
let size = 5;
for (let i = 0; i < 60; i++) {
    // Change color every few steps
    await t.pencolor(colors[i % colors.length]);

    await t.forward(size);
    await t.right(30);

    // Increase size slightly with each iteration
    size += 1.5;
}

// Finish with a dot
await t.dot(20, "purple");