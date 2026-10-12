package server

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/ekup/ai-for-developers-project-386/backend/internal/api"
	"github.com/ekup/ai-for-developers-project-386/backend/internal/store"
)

// handlers реализует сгенерированный строгий интерфейс API поверх хранилища.
type handlers struct {
	db *sql.DB
}

// EventTypesList отдаёт активные типы событий.
func (h *handlers) EventTypesList(
	ctx context.Context,
	_ api.EventTypesListRequestObject,
) (api.EventTypesListResponseObject, error) {
	types, err := store.ListEventTypes(ctx, h.db)
	if err != nil {
		return nil, err
	}

	resp := make(api.EventTypesList200JSONResponse, 0, len(types))
	for _, et := range types {
		resp = append(resp, api.EventType{
			Id:              int32(et.ID),
			Name:            et.Name,
			Description:     et.Description,
			DurationMinutes: int32(et.DurationMinutes),
		})
	}

	return resp, nil
}

// Операции ниже реализуются в следующих срезах и пока отвечают 501.

// BookingsWindow отдаёт окно записи — первый и последний день, доступные гостю.
func (h *handlers) BookingsWindow(
	_ context.Context,
	_ api.BookingsWindowRequestObject,
) (api.BookingsWindowResponseObject, error) {
	start, end := store.BookingWindow(time.Now())

	return api.BookingsWindow200JSONResponse{
		Start: openapi_types.Date{Time: start},
		End:   openapi_types.Date{Time: end},
	}, nil
}

func (h *handlers) BookingsCreate(
	_ context.Context,
	_ api.BookingsCreateRequestObject,
) (api.BookingsCreateResponseObject, error) {
	return notImplemented{}, nil
}

func (h *handlers) BookingsUpcoming(
	_ context.Context,
	_ api.BookingsUpcomingRequestObject,
) (api.BookingsUpcomingResponseObject, error) {
	return notImplemented{}, nil
}

func (h *handlers) EventTypesCreate(
	_ context.Context,
	_ api.EventTypesCreateRequestObject,
) (api.EventTypesCreateResponseObject, error) {
	return notImplemented{}, nil
}

func (h *handlers) EventTypesRemove(
	_ context.Context,
	_ api.EventTypesRemoveRequestObject,
) (api.EventTypesRemoveResponseObject, error) {
	return notImplemented{}, nil
}

func (h *handlers) EventTypesUpdate(
	_ context.Context,
	_ api.EventTypesUpdateRequestObject,
) (api.EventTypesUpdateResponseObject, error) {
	return notImplemented{}, nil
}

// EventTypesSlots отдаёт свободные старты слотов типа события на дату.
func (h *handlers) EventTypesSlots(
	ctx context.Context,
	req api.EventTypesSlotsRequestObject,
) (api.EventTypesSlotsResponseObject, error) {
	slots, err := store.Slots(ctx, h.db, int64(req.Id), req.Params.Date.Time, time.Now())
	if errors.Is(err, store.ErrNotFound) {
		return api.EventTypesSlots404JSONResponse{Error: "тип события не найден"}, nil
	}
	if err != nil {
		return nil, err
	}

	return api.EventTypesSlots200JSONResponse{
		Date:  req.Params.Date,
		Slots: slots,
	}, nil
}

// notImplemented отвечает 501 Not Implemented на ещё не реализованные операции.
type notImplemented struct{}

func (notImplemented) VisitBookingsCreateResponse(w http.ResponseWriter) error {
	return writeNotImplemented(w)
}

func (notImplemented) VisitBookingsUpcomingResponse(w http.ResponseWriter) error {
	return writeNotImplemented(w)
}

func (notImplemented) VisitEventTypesCreateResponse(w http.ResponseWriter) error {
	return writeNotImplemented(w)
}

func (notImplemented) VisitEventTypesRemoveResponse(w http.ResponseWriter) error {
	return writeNotImplemented(w)
}

func (notImplemented) VisitEventTypesUpdateResponse(w http.ResponseWriter) error {
	return writeNotImplemented(w)
}

func writeNotImplemented(w http.ResponseWriter) error {
	w.WriteHeader(http.StatusNotImplemented)
	return nil
}
