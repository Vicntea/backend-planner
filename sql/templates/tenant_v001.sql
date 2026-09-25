-- Tenant schema template v001.
-- The provisioning script replaces __TENANT_SCHEMA__ only after RUT validation.
-- Do not execute this file directly.
CREATE TABLE IF NOT EXISTS __TENANT_SCHEMA__.voucher_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    logo_url TEXT,

    design_json JSONB NOT NULL DEFAULT '{}'::JSONB,

    show_phone BOOLEAN NOT NULL DEFAULT TRUE,

    show_email BOOLEAN NOT NULL DEFAULT TRUE,

    show_address BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


DROP TRIGGER IF EXISTS trg_voucher_config_updated_at
ON __TENANT_SCHEMA__.voucher_config;

CREATE TRIGGER trg_voucher_config_updated_at
BEFORE UPDATE ON __TENANT_SCHEMA__.voucher_config
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


ALTER TABLE __TENANT_SCHEMA__.voucher_config
ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_members_voucher_config_select"
ON __TENANT_SCHEMA__.voucher_config
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


CREATE POLICY "tenant_members_voucher_config_insert"
ON __TENANT_SCHEMA__.voucher_config
FOR INSERT
TO authenticated
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


CREATE POLICY "tenant_members_voucher_config_update"
ON __TENANT_SCHEMA__.voucher_config
FOR UPDATE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
)
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


CREATE POLICY "tenant_members_voucher_config_delete"
ON __TENANT_SCHEMA__.voucher_config
FOR DELETE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


-- =========================================================
-- CLIENTES
-- =========================================================

CREATE TABLE IF NOT EXISTS __TENANT_SCHEMA__.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    nombre VARCHAR(100) NOT NULL,

    apellido VARCHAR(100),

    email VARCHAR(255),

    telefono VARCHAR(30),

    -- RUT cifrado.
    rut_cifrado BYTEA,

    -- HMAC del RUT normalizado.
    -- Permite bÃºsqueda exacta sin almacenar el RUT en claro.
    rut_lookup BYTEA,

    -- Permite rotaciÃ³n de claves.
    rut_key_version SMALLINT NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT cliente_rut_consistencia_check
        CHECK (
            (rut_cifrado IS NULL) = (rut_lookup IS NULL)
        ),

    CONSTRAINT cliente_rut_key_version_check
        CHECK (rut_key_version > 0)
);


CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_rut_lookup
ON __TENANT_SCHEMA__.clientes(rut_lookup)
WHERE rut_lookup IS NOT NULL;


CREATE INDEX IF NOT EXISTS idx_clientes_email
ON __TENANT_SCHEMA__.clientes(email);


CREATE INDEX IF NOT EXISTS idx_clientes_nombre
ON __TENANT_SCHEMA__.clientes(nombre);


DROP TRIGGER IF EXISTS trg_clientes_updated_at
ON __TENANT_SCHEMA__.clientes;

CREATE TRIGGER trg_clientes_updated_at
BEFORE UPDATE ON __TENANT_SCHEMA__.clientes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


ALTER TABLE __TENANT_SCHEMA__.clientes
ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_members_clientes_select"
ON __TENANT_SCHEMA__.clientes
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


CREATE POLICY "tenant_members_clientes_insert"
ON __TENANT_SCHEMA__.clientes
FOR INSERT
TO authenticated
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


CREATE POLICY "tenant_members_clientes_update"
ON __TENANT_SCHEMA__.clientes
FOR UPDATE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
)
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


CREATE POLICY "tenant_members_clientes_delete"
ON __TENANT_SCHEMA__.clientes
FOR DELETE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


-- =========================================================
-- HABITACIONES
-- =========================================================

CREATE TABLE IF NOT EXISTS __TENANT_SCHEMA__.habitaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    nombre VARCHAR(100) NOT NULL,

    tipo VARCHAR(50),

    descripcion TEXT,

    capacidad INTEGER NOT NULL DEFAULT 1,

    precio_noche NUMERIC(12,2) NOT NULL DEFAULT 0,

    moneda VARCHAR(3) NOT NULL DEFAULT 'CLP',

    estado VARCHAR(30) NOT NULL DEFAULT 'activa',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT habitaciones_nombre_unique
        UNIQUE (nombre),

    CONSTRAINT habitaciones_capacidad_check
        CHECK (capacidad > 0),

    CONSTRAINT habitaciones_precio_check
        CHECK (precio_noche >= 0),

    CONSTRAINT habitaciones_estado_check
        CHECK (
            estado IN (
                'activa',
                'mantenimiento',
                'inactiva'
            )
        )
);


CREATE INDEX IF NOT EXISTS idx_habitaciones_estado
ON __TENANT_SCHEMA__.habitaciones(estado);


DROP TRIGGER IF EXISTS trg_habitaciones_updated_at
ON __TENANT_SCHEMA__.habitaciones;

CREATE TRIGGER trg_habitaciones_updated_at
BEFORE UPDATE ON __TENANT_SCHEMA__.habitaciones
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


ALTER TABLE __TENANT_SCHEMA__.habitaciones
ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_members_habitaciones_select"
ON __TENANT_SCHEMA__.habitaciones
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


CREATE POLICY "tenant_members_habitaciones_insert"
ON __TENANT_SCHEMA__.habitaciones
FOR INSERT
TO authenticated
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


CREATE POLICY "tenant_members_habitaciones_update"
ON __TENANT_SCHEMA__.habitaciones
FOR UPDATE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
)
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


CREATE POLICY "tenant_members_habitaciones_delete"
ON __TENANT_SCHEMA__.habitaciones
FOR DELETE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


-- =========================================================
-- VOUCHERS
-- =========================================================

CREATE TABLE IF NOT EXISTS __TENANT_SCHEMA__.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    base64 TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


ALTER TABLE __TENANT_SCHEMA__.vouchers
ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_members_vouchers_select"
ON __TENANT_SCHEMA__.vouchers
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


CREATE POLICY "tenant_members_vouchers_insert"
ON __TENANT_SCHEMA__.vouchers
FOR INSERT
TO authenticated
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


CREATE POLICY "tenant_members_vouchers_update"
ON __TENANT_SCHEMA__.vouchers
FOR UPDATE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
)
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


CREATE POLICY "tenant_members_vouchers_delete"
ON __TENANT_SCHEMA__.vouchers
FOR DELETE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


-- =========================================================
-- RESERVAS
-- =========================================================

CREATE TABLE IF NOT EXISTS __TENANT_SCHEMA__.reservas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    habitacion_id UUID NOT NULL
        REFERENCES __TENANT_SCHEMA__.habitaciones(id),

    cliente_id UUID NOT NULL
        REFERENCES __TENANT_SCHEMA__.clientes(id),

    voucher_id UUID
        REFERENCES __TENANT_SCHEMA__.vouchers(id)
        ON DELETE SET NULL,

    codigo VARCHAR(30) NOT NULL UNIQUE,

    check_in DATE NOT NULL,

    check_out DATE NOT NULL,

    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',

    cantidad_huespedes INTEGER NOT NULL DEFAULT 1,

    precio_noche NUMERIC(12,2) NOT NULL DEFAULT 0,

    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,

    descuento NUMERIC(12,2) NOT NULL DEFAULT 0,

    impuestos NUMERIC(12,2) NOT NULL DEFAULT 0,

    total NUMERIC(12,2) NOT NULL DEFAULT 0,

    moneda VARCHAR(3) NOT NULL DEFAULT 'CLP',

    notas TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT reservas_fechas_check
        CHECK (check_out > check_in),

    CONSTRAINT reservas_huespedes_check
        CHECK (cantidad_huespedes > 0),

    CONSTRAINT reservas_montos_check
        CHECK (
            precio_noche >= 0
            AND subtotal >= 0
            AND descuento >= 0
            AND impuestos >= 0
            AND total >= 0
        ),

    CONSTRAINT reservas_estado_check
        CHECK (
            estado IN (
                'pendiente',
                'confirmada',
                'cancelada',
                'completada',
                'no_show'
            )
        )
);


CREATE INDEX IF NOT EXISTS idx_reservas_habitacion
ON __TENANT_SCHEMA__.reservas(habitacion_id);


CREATE INDEX IF NOT EXISTS idx_reservas_cliente
ON __TENANT_SCHEMA__.reservas(cliente_id);


CREATE INDEX IF NOT EXISTS idx_reservas_fecha
ON __TENANT_SCHEMA__.reservas(
    check_in,
    check_out
);


CREATE INDEX IF NOT EXISTS idx_reservas_estado
ON __TENANT_SCHEMA__.reservas(estado);


CREATE UNIQUE INDEX IF NOT EXISTS idx_reservas_voucher
ON __TENANT_SCHEMA__.reservas(voucher_id)
WHERE voucher_id IS NOT NULL;


DROP TRIGGER IF EXISTS trg_reservas_updated_at
ON __TENANT_SCHEMA__.reservas;

CREATE TRIGGER trg_reservas_updated_at
BEFORE UPDATE ON __TENANT_SCHEMA__.reservas
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


ALTER TABLE __TENANT_SCHEMA__.reservas
ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_members_reservas_select"
ON __TENANT_SCHEMA__.reservas
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


CREATE POLICY "tenant_members_reservas_insert"
ON __TENANT_SCHEMA__.reservas
FOR INSERT
TO authenticated
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


CREATE POLICY "tenant_members_reservas_update"
ON __TENANT_SCHEMA__.reservas
FOR UPDATE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
)
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


CREATE POLICY "tenant_members_reservas_delete"
ON __TENANT_SCHEMA__.reservas
FOR DELETE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


-- =========================================================
-- EVITAR RESERVAS SOLAPADAS
-- =========================================================

ALTER TABLE __TENANT_SCHEMA__.reservas
DROP CONSTRAINT IF EXISTS evitar_reservas_solapadas;


ALTER TABLE __TENANT_SCHEMA__.reservas
ADD CONSTRAINT evitar_reservas_solapadas
EXCLUDE USING GIST (
    habitacion_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
)
WHERE (
    estado IN (
        'pendiente',
        'confirmada'
    )
);


-- =========================================================
-- HUÃ‰SPEDES DE UNA RESERVA
-- =========================================================

CREATE TABLE IF NOT EXISTS __TENANT_SCHEMA__.reserva_huespedes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    reserva_id UUID NOT NULL
        REFERENCES __TENANT_SCHEMA__.reservas(id)
        ON DELETE CASCADE,

    nombre VARCHAR(100) NOT NULL,

    apellido VARCHAR(100),

    edad INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT reserva_huespedes_edad_check
        CHECK (
            edad IS NULL
            OR edad >= 0
        )
);


CREATE INDEX IF NOT EXISTS idx_reserva_huespedes_reserva
ON __TENANT_SCHEMA__.reserva_huespedes(reserva_id);


ALTER TABLE __TENANT_SCHEMA__.reserva_huespedes
ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_members_reserva_huespedes_select"
ON __TENANT_SCHEMA__.reserva_huespedes
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


CREATE POLICY "tenant_members_reserva_huespedes_insert"
ON __TENANT_SCHEMA__.reserva_huespedes
FOR INSERT
TO authenticated
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


CREATE POLICY "tenant_members_reserva_huespedes_update"
ON __TENANT_SCHEMA__.reserva_huespedes
FOR UPDATE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
)
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);


CREATE POLICY "tenant_members_reserva_huespedes_delete"
ON __TENANT_SCHEMA__.reserva_huespedes
FOR DELETE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            '__TENANT_SCHEMA__'
        )
    )
);
