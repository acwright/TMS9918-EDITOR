The goal of this project is to create a character and screen editor for the TMS9918 VDP. I would like you to create a multi-phase plan for this editor and save it as PLAN.md in the project root so it can
be reused in multiple agent sessions.

The project should be built as a VueJS single-page web application using Typescript. The deployment target should be Github pages. The font should be Bebas Neue. The overall feel should be a modern web application. Use an appropriate
modern icon set. All buttons should also have hover tooltips and appropriate keyboard equivalents (Shown on tooltip hover). The focus of the application will be desktop browsers but some attention should still be
paid to being somewhat mobile friendly (particularly tablets).

The editor will manage and edit documents in the form of a project file. Project files should contain JSON data that contains all character set and screen data as well as project type and any other project
settings we may encounter. The editor can open, save, edit and delete project files. Project files should be stored by default in the uses browser (local storage?) but also be downloadable and uploadable from
the end users computer to the browser and vice-versa. Overall color scheme should be mostly black and white with grayscale when needed and color used sparingly if appropriate. Upon arriving at the web application you should be greated with a project file management view. 
This screen should then take you to the main editor view.

A project file will be of one of three types based on the VDP modes:

1. Text mode
2. Graphics Mode I
3. Graphics Mode II

The project type will determine the features available in the editor. All projects share a similar UI which has the following base features:

- An 8x8 gridded pixel editor for the currently selected character from the character set (top-left of UI)
 - Mouse right or left-click to turn on or off a pixel in current foreground color
 - Mouse right or left-click and drag to "draw" pixels in current foreground color
 - Buttons for fill (all pixels), clear (all pixels), invert, shift left/right/up/down, rotate left/right, flip vertical/horizontal in an approprite order
 - Pixels not "set" are displayed in current background color
 - A copyable text box with the 8 bytes of the current character in ca65 hexadecimal form ".byte $00, $00, $00, $00, $00, $00, $00, $00" for easy copying to assembly code.
 - A 3x3 wallpaper preview of the currently selected character
 - Color selection (described further below)

- An character set picker/list in an 8 x 32 layout (bottom-left; under the pixel editor)
  - Clicking on a character selects this character for editing in the pixel editor and also as the current character for screen editing
  - In Graphics Mode II this panel should also include a paginator for selecting which of the three 256 character sets is visible if using independant character sets for the three sections of the 
    Graphics Mode II screen. This should be a setting at project creation. Either all three sets are used (bitmap mode as described in TMS9918 Programmers Reference Guide) or we can simply use the same 256
    character set mirrored to all three screen sections. If you have other ideas lets discuss.

- Screen editor (right; fill remaining UI area)
  - A 32x24 gridded screen editor for Graphics Mode I and II (8x8 cell size)
  - A 40x24 gridded screen editor for Text Mode (6x8 cell size)
  - Mouse left-click to set character at mouse position
  - Mouse left-click and drag to "draw" draw characters
  - Mouse right-click to clear character at mouse position
  - A centered top toolbar with import/export (share), scale (magnification; 1x-8x), grid overlay on/off, rotate left/right, flip vertical/horizontal, shift left/right/up/down buttons, clear all, fill all (current character), undo, redo
    and screen/map paginator with add/delete (multiple screens can be created per project) buttons in an approprite order.

Color selection is the main difference between the modes other than the overall screen area dimensions. Color selection for Text Mode is simply a foreground and background color for all characters. Color selection for
Graphics Mode I is background and foreground color for each row of the 8 x 32 character set grid. Color selection for Graphics Mode II is foreground and background color for each row of 8 pixels in the current
character. To this end I imagine a possibility for the UI is to have the color picker, in the form of a 2x8 grid of colors, off to the right of the pixel editor at all times. In Text Mode you can simply left-click this
color grid for foreground color and background color. In Graphics Mode I you would do the same however of course it would change based on which character row you were editing. In Graphics Mode II however I'm not 
quite sure what I want... One possibility is to add a button to the right of each pixel row in the pixel editor that shows the current two colors for that row and clicking on it selects it for editing in the color
picker. If you have other ideas I'm open to them. The color picker grid should show an F and B over the correct color for foreground and background respectively.

Be sure to include editing the README with project description, screenshot (when we have it), and dev/build instructions, etc

Out of scope for now:

- Import/Export (add the UI button but we will come back to this)
- Multicolor Mode