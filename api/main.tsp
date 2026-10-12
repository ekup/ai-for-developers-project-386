import "@typespec/http";
import "@typespec/openapi3";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

@service(#{ title: "Запись на звонок" })
@server("http://localhost:8080", "Локальный сервер")
namespace CallBooking;

// ─── Модели ──────────────────────────────────────────────────────────────────

@doc("Тип события: шаблон встречи, по которому гость выбирает слот.")
model EventType {
  @doc("Системный идентификатор.")
  id: int32;

  @doc("Название.")
  name: string;

  @doc("Описание.")
  description: string;

  @doc("Длительность в минутах.")
  durationMinutes: int32;
}

@doc("Данные для создания типа события.")
model CreateEventTypeRequest {
  name: string;
  description: string;
  durationMinutes: int32;
}

@doc("Данные для правки типа события.")
model UpdateEventTypeRequest {
  name: string;
  description: string;
}

@doc("Свободные слоты на дату.")
model SlotList {
  @doc("Дата (YYYY-MM-DD).")
  date: plainDate;

  @doc("Начала свободных слотов.")
  slots: utcDateTime[];
}

@doc("Запись гостя на слот.")
model Booking {
  id: int32;
  eventType: EventType;
  startsAt: utcDateTime;
  guestName: string;
  guestEmail: string;
  comment: string;
}

@doc("Данные для создания записи.")
model CreateBookingRequest {
  eventTypeId: int32;
  startsAt: utcDateTime;
  guestName: string;
  guestEmail: string;
  comment?: string;
}

@doc("Тело ошибки.")
model ApiErrorBody {
  @doc("Человекочитаемое описание ошибки.")
  error: string;
}

@error
model ErrorResponse {
  @statusCode _: 400 | 404 | 409 | 422;
  @body body: ApiErrorBody;
}

@doc("Успешное создание типа события.")
model EventTypeCreated {
  @statusCode _: 201;
  @body body: EventType;
}

@doc("Успешное создание записи.")
model BookingCreated {
  @statusCode _: 201;
  @body body: Booking;
}

@doc("Успешное удаление без тела.")
model NoContent {
  @statusCode _: 204;
}

// ─── Маршруты ────────────────────────────────────────────────────────────────

@route("/api")
namespace Api {
  @tag("Типы событий")
  @route("/event-types")
  interface EventTypes {
    @doc("Список активных типов событий.")
    @get
    list(): EventType[] | ErrorResponse;

    @doc("Создать тип события (владелец).")
    @post
    create(@body body: CreateEventTypeRequest): EventTypeCreated | ErrorResponse;

    @doc("Изменить название и описание типа события (владелец).")
    @patch
    update(@path id: int32, @body body: UpdateEventTypeRequest): EventType | ErrorResponse;

    @doc("Мягко удалить тип события (владелец).")
    @delete
    remove(@path id: int32): NoContent | ErrorResponse;

    @doc("Свободные слоты типа события на дату.")
    @route("/{id}/slots")
    @get
    slots(@path id: int32, @query date: plainDate): SlotList | ErrorResponse;
  }

  @tag("Записи")
  @route("/bookings")
  interface Bookings {
    @doc("Создать запись на слот (гость).")
    @post
    create(@body body: CreateBookingRequest): BookingCreated | ErrorResponse;

    @doc("Предстоящие встречи всех типов (владелец).")
    @route("/upcoming")
    @get
    upcoming(): Booking[] | ErrorResponse;
  }
}
