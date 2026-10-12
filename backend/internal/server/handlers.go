package server

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"net/mail"
	"strings"
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
		resp = append(resp, toAPIEventType(et))
	}

	return resp, nil
}

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
	ctx context.Context,
	req api.BookingsCreateRequestObject,
) (api.BookingsCreateResponseObject, error) {
	if req.Body == nil {
		return api.BookingsCreate400JSONResponse{Error: "тело запроса обязательно"}, nil
	}

	params, problem := bookingParams(*req.Body)
	if problem != "" {
		return api.BookingsCreate400JSONResponse{Error: problem}, nil
	}

	booking, err := store.CreateBooking(ctx, h.db, params, time.Now())
	switch {
	case errors.Is(err, store.ErrNotFound):
		return api.BookingsCreate404JSONResponse{Error: "тип события не найден"}, nil
	case errors.Is(err, store.ErrConflict):
		return api.BookingsCreate409JSONResponse{Error: "слот уже занят"}, nil
	case errors.Is(err, store.ErrUnprocessable):
		return api.BookingsCreate422JSONResponse{Error: "время недоступно для записи"}, nil
	case err != nil:
		return nil, err
	}

	return api.BookingsCreate201JSONResponse(toAPIBooking(booking)), nil
}

// bookingParams проверяет обязательные поля запроса и приводит их к параметрам
// хранилища. Возвращает текст ошибки, если данные невалидны.
func bookingParams(body api.CreateBookingRequest) (store.CreateBookingParams, string) {
	name := strings.TrimSpace(body.GuestName)
	if name == "" {
		return store.CreateBookingParams{}, "имя обязательно"
	}

	email := strings.TrimSpace(body.GuestEmail)
	if !validEmail(email) {
		return store.CreateBookingParams{}, "укажите корректный email"
	}

	comment := ""
	if body.Comment != nil {
		comment = strings.TrimSpace(*body.Comment)
	}

	return store.CreateBookingParams{
		EventTypeID: int64(body.EventTypeId),
		StartsAt:    body.StartsAt,
		GuestName:   name,
		GuestEmail:  email,
		Comment:     comment,
	}, ""
}

// validEmail сообщает, является ли строка корректным адресом без отображаемого
// имени — email гостя должен быть именно адресом.
func validEmail(email string) bool {
	addr, err := mail.ParseAddress(email)
	return err == nil && addr.Address == email
}

// toAPIEventType переводит тип события хранилища в формат ответа API.
func toAPIEventType(et store.EventType) api.EventType {
	return api.EventType{
		Id:              int32(et.ID),
		Description:     et.Description,
		Name:            et.Name,
		DurationMinutes: int32(et.DurationMinutes),
	}
}

// toAPIBooking переводит запись хранилища в формат ответа API.
func toAPIBooking(b store.Booking) api.Booking {
	return api.Booking{
		Id:         int32(b.ID),
		EventType:  toAPIEventType(b.EventType),
		StartsAt:   b.StartsAt,
		GuestName:  b.GuestName,
		GuestEmail: b.GuestEmail,
		Comment:    b.Comment,
	}
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
