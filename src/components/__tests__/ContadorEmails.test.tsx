import { render, screen } from "@testing-library/react";
import { ContadorEmails } from "../ContadorEmails";

describe("ContadorEmails", () => {
  it("con una sola dirección no pinta nada", () => {
    const { container } = render(<ContadorEmails email="ana@x.com" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("con dos o más muestra el número de direcciones", () => {
    render(<ContadorEmails email="ana@x.com, padre@y.com, madre@z.com" />);
    expect(screen.getByLabelText("3 direcciones de correo")).toHaveTextContent("3");
  });
});
