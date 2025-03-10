// Five-pointed Star
// This example draws a colorful star with the turtle

// Set up the drawing
penup();
goto(-100, 50);
pendown();
pensize(3);
pencolor("purple");

// Draw the star
begin_fill();
fillcolor("gold");
for (let i = 0; i < 5; i++) {
    forward(200);
    right(144);
}
end_fill();

// Add a small signature
penup();
goto(0, -150);
pencolor("black");
write("TurtleJS Star", false, "center", "14px Arial");
goto(0, 0);