// Simple Square
// This example draws a colorful square with the turtle

// Set up the drawing
penup();
goto(-100, -100);
pendown();
pensize(5);
pencolor("blue");
setheading(90)
// Draw the square
begin_fill();
fillcolor("lightblue");
for (let i = 0; i < 4; i++) {
    forward(200);
    right(90);
}
end_fill();

// Return to center
penup();
goto(0, 0);
pendown();