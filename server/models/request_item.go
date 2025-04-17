package models

// RequestItem представляет элемент спецификации в заявке
type RequestItem struct {
	ID                    int      `json:"id"`
	RequestID             int      `json:"request_id"`
	ProductID             *int     `json:"product_id,omitempty"`
	CustomItemSKU         string   `json:"custom_item_sku,omitempty"`
	CustomItemName        string   `json:"custom_item_name,omitempty"`
	CustomItemDescription string   `json:"custom_item_description,omitempty"`
	Quantity              int      `json:"quantity"`
	UnitPrice             *float64 `json:"unit_price,omitempty"`
	TotalPrice            *float64 `json:"total_price,omitempty"`

	// Связанные данные
	Product *Product `json:"product,omitempty"`
}
