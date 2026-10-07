#!/usr/bin/env python3
"""
Unit test for Amazon Email Parser & Ollama Categorization
"""
from decimal import Decimal
from syncer import (
    extract_order_id,
    extract_amounts,
    extract_items_from_html,
    categorize_with_ollama,
)

SAMPLE_AMAZON_SHIPMENT_HTML = """
<!DOCTYPE html>
<html>
<head><title>Your Amazon.com order #114-7294821-3928174 has shipped</title></head>
<body>
  <div>
    <h2>Order #114-7294821-3928174</h2>
    <p>Hi Rakesh, your package has shipped!</p>
    <table>
      <tr>
        <td>
          <img src="https://m.media-amazon.com/images/I/71example.jpg" alt="Cascade Platinum Plus ActionPacs Dishwasher Detergent, Fresh Scent, 52 Count" />
        </td>
        <td>
          <a href="https://www.amazon.com/gp/product/B09XYZ1234?ref=em_1p_0_ti">
            Cascade Platinum Plus ActionPacs Dishwasher Detergent, Fresh Scent, 52 Count
          </a>
        </td>
      </tr>
      <tr>
        <td>
          <img src="https://m.media-amazon.com/images/I/61example2.jpg" alt="Scotch Heavy Duty Packaging Tape with Dispenser, 6 Rolls" />
        </td>
        <td>
          <a href="https://www.amazon.com/gp/product/B08ABC5678?ref=em_1p_1_ti">
            Scotch Heavy Duty Packaging Tape with Dispenser, 6 Rolls
          </a>
        </td>
      </tr>
    </table>
    <div>
      <p>Item Subtotal: $24.99</p>
      <p>Shipping & Handling: $0.00</p>
      <p>Estimated Tax: $1.82</p>
      <p><strong>Shipment Total: $26.81</strong></p>
    </div>
  </div>
</body>
</html>
"""

def test_parser():
    subject = "Your Amazon.com order #114-7294821-3928174 has shipped"
    
    # 1. Test Order ID Extraction
    order_id = extract_order_id(subject, SAMPLE_AMAZON_SHIPMENT_HTML)
    assert order_id == "114-7294821-3928174", f"Expected 114-7294821-3928174, got {order_id}"
    print(f"✓ Order ID extracted: {order_id}")

    # 2. Test Amount Extraction
    amounts = extract_amounts(SAMPLE_AMAZON_SHIPMENT_HTML, "")
    assert Decimal("26.81") in amounts, f"Expected 26.81 in amounts, got {amounts}"
    print(f"✓ Amounts extracted: {amounts}")

    # 3. Test Items Extraction
    items = extract_items_from_html(SAMPLE_AMAZON_SHIPMENT_HTML)
    assert len(items) >= 2, f"Expected at least 2 items, got {items}"
    assert "Cascade Platinum" in items[0] or "Cascade Platinum" in items[1]
    print(f"✓ Items extracted ({len(items)}): {items}")

    # 4. Test Ollama Categorization
    cat, subcat = categorize_with_ollama(items, order_id)
    print(f"✓ Ollama classification: {cat} • {subcat}")
    assert cat in ["Home Improvement", "Shopping"], f"Unexpected category: {cat}"

    print("\nALL PARSER & LLM TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_parser()
