-- =========================================================
-- SUPABASE / POSTGRESQL
-- TENANT DE PRUEBA: client_00000000
-- =========================================================


-- =========================================================
-- EXTENSIONES
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;


-- =========================================================
-- SCHEMA PRIVADO PARA FUNCIONES AUXILIARES
-- =========================================================

CREATE SCHEMA IF NOT EXISTS private;


-- =========================================================
-- FUNCIÓN GENERAL updated_at
-- =========================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


-- =========================================================
-- TENANTS
-- Información general de cada empresa
-- =========================================================

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    rut VARCHAR(12) NOT NULL UNIQUE,

    nombre VARCHAR(150) NOT NULL,

    slug VARCHAR(100) NOT NULL UNIQUE,

    -- Ejemplo:
    -- client_00000000
    schema_name VARCHAR(63) NOT NULL UNIQUE,

    timezone VARCHAR(64) NOT NULL DEFAULT 'America/Santiago',

    activo BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT tenants_schema_name_check
        CHECK (
            schema_name ~ '^client_[0-9]+$'
        )
);


CREATE INDEX IF NOT EXISTS idx_tenants_active
    ON public.tenants(activo);


DROP TRIGGER IF EXISTS trg_tenants_updated_at
ON public.tenants;

CREATE TRIGGER trg_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


-- =========================================================
-- CONFIGURACIÓN GENERAL DEL TENANT
-- =========================================================

CREATE TABLE IF NOT EXISTS public.tenant_config (
    tenant_id UUID PRIMARY KEY
        REFERENCES public.tenants(id)
        ON DELETE CASCADE,

    nombre_comercial VARCHAR(200) NOT NULL,

    telefono VARCHAR(30),

    email VARCHAR(255),

    direccion VARCHAR(300),

    check_in_time TIME,

    check_out_time TIME,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


DROP TRIGGER IF EXISTS trg_tenant_config_updated_at
ON public.tenant_config;

CREATE TRIGGER trg_tenant_config_updated_at
BEFORE UPDATE ON public.tenant_config
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


-- =========================================================
-- USUARIOS DEL TENANT
-- Relación con Supabase Auth
-- =========================================================

CREATE TABLE IF NOT EXISTS public.tenant_members (
    tenant_id UUID NOT NULL
        REFERENCES public.tenants(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL DEFAULT 'member',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (tenant_id, user_id),

    CONSTRAINT tenant_member_role_check
        CHECK (
            role IN (
                'owner',
                'admin',
                'member'
            )
        )
);


CREATE INDEX IF NOT EXISTS idx_tenant_members_user
    ON public.tenant_members(user_id);

CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant
    ON public.tenant_members(tenant_id);


-- =========================================================
-- FUNCIÓN:
-- ¿EL USUARIO AUTENTICADO PERTENECE AL TENANT?
-- =========================================================

CREATE OR REPLACE FUNCTION private.user_is_tenant_member(
    p_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.tenant_members tm
        INNER JOIN public.tenants t
            ON t.id = tm.tenant_id
        WHERE tm.tenant_id = p_tenant_id
          AND tm.user_id = (SELECT auth.uid())
          AND t.activo = TRUE
    );
$$;


GRANT USAGE ON SCHEMA private TO authenticated;

GRANT EXECUTE
ON FUNCTION private.user_is_tenant_member(UUID)
TO authenticated;


-- =========================================================
-- FUNCIÓN:
-- ¿EL USUARIO PERTENECE AL SCHEMA?
-- =========================================================

CREATE OR REPLACE FUNCTION private.user_is_member_of_schema(
    p_schema_name TEXT
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.tenants t
        INNER JOIN public.tenant_members tm
            ON tm.tenant_id = t.id
        WHERE t.schema_name = p_schema_name
          AND t.activo = TRUE
          AND tm.user_id = (SELECT auth.uid())
    );
$$;


GRANT EXECUTE
ON FUNCTION private.user_is_member_of_schema(TEXT)
TO authenticated;


-- =========================================================
-- RLS EN PUBLIC
-- =========================================================

ALTER TABLE public.tenants
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tenant_config
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tenant_members
ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- RLS: TENANTS
-- =========================================================

CREATE POLICY "tenant_members_can_read_tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.user_is_tenant_member(id)
    )
);


-- =========================================================
-- RLS: TENANT CONFIG
-- =========================================================

CREATE POLICY "tenant_members_can_read_config"
ON public.tenant_config
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.user_is_tenant_member(tenant_id)
    )
);


-- =========================================================
-- RLS: TENANT MEMBERS
-- =========================================================

CREATE POLICY "users_can_read_own_membership"
ON public.tenant_members
FOR SELECT
TO authenticated
USING (
    user_id = (SELECT auth.uid())
);


-- =========================================================
-- TENANT DE PRUEBA
--
-- RUT:
-- 00000000-0
--
-- SCHEMA:
-- client_00000000
-- =========================================================

INSERT INTO public.tenants (
    rut,
    nombre,
    slug,
    schema_name,
    timezone
)
VALUES (
    '00000000-0',
    'Tenant de Prueba',
    'tenant-test',
    'client_00000000',
    'America/Santiago'
)
ON CONFLICT (rut)
DO UPDATE SET
    nombre = EXCLUDED.nombre,
    slug = EXCLUDED.slug,
    schema_name = EXCLUDED.schema_name,
    timezone = EXCLUDED.timezone,
    updated_at = now();


-- =========================================================
-- CONFIGURACIÓN DEL TENANT DE PRUEBA
-- =========================================================

INSERT INTO public.tenant_config (
    tenant_id,
    nombre_comercial,
    telefono,
    email,
    direccion,
    check_in_time,
    check_out_time
)
SELECT
    id,
    'Alojamiento de Prueba',
    '+56900000000',
    'test@example.com',
    'Dirección de prueba',
    '15:00',
    '11:00'
FROM public.tenants
WHERE rut = '00000000-0'
ON CONFLICT (tenant_id)
DO UPDATE SET
    nombre_comercial = EXCLUDED.nombre_comercial,
    telefono = EXCLUDED.telefono,
    email = EXCLUDED.email,
    direccion = EXCLUDED.direccion,
    check_in_time = EXCLUDED.check_in_time,
    check_out_time = EXCLUDED.check_out_time,
    updated_at = now();


-- =========================================================
-- SCHEMA PRIVADO
-- =========================================================

CREATE SCHEMA IF NOT EXISTS client_00000000;


-- =========================================================
-- VOUCHER CONFIG
-- =========================================================

CREATE TABLE IF NOT EXISTS client_00000000.voucher_config (
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
ON client_00000000.voucher_config;

CREATE TRIGGER trg_voucher_config_updated_at
BEFORE UPDATE ON client_00000000.voucher_config
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


ALTER TABLE client_00000000.voucher_config
ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_members_voucher_config_select"
ON client_00000000.voucher_config
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


CREATE POLICY "tenant_members_voucher_config_insert"
ON client_00000000.voucher_config
FOR INSERT
TO authenticated
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


CREATE POLICY "tenant_members_voucher_config_update"
ON client_00000000.voucher_config
FOR UPDATE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
)
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


CREATE POLICY "tenant_members_voucher_config_delete"
ON client_00000000.voucher_config
FOR DELETE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


-- =========================================================
-- CLIENTES
-- =========================================================

CREATE TABLE IF NOT EXISTS client_00000000.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    nombre VARCHAR(100) NOT NULL,

    apellido VARCHAR(100),

    email VARCHAR(255),

    telefono VARCHAR(30),

    -- RUT cifrado.
    rut_cifrado BYTEA,

    -- HMAC del RUT normalizado.
    -- Permite búsqueda exacta sin almacenar el RUT en claro.
    rut_lookup BYTEA,

    -- Permite rotación de claves.
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
ON client_00000000.clientes(rut_lookup)
WHERE rut_lookup IS NOT NULL;


CREATE INDEX IF NOT EXISTS idx_clientes_email
ON client_00000000.clientes(email);


CREATE INDEX IF NOT EXISTS idx_clientes_nombre
ON client_00000000.clientes(nombre);


DROP TRIGGER IF EXISTS trg_clientes_updated_at
ON client_00000000.clientes;

CREATE TRIGGER trg_clientes_updated_at
BEFORE UPDATE ON client_00000000.clientes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


ALTER TABLE client_00000000.clientes
ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_members_clientes_select"
ON client_00000000.clientes
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


CREATE POLICY "tenant_members_clientes_insert"
ON client_00000000.clientes
FOR INSERT
TO authenticated
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


CREATE POLICY "tenant_members_clientes_update"
ON client_00000000.clientes
FOR UPDATE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
)
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


CREATE POLICY "tenant_members_clientes_delete"
ON client_00000000.clientes
FOR DELETE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


-- =========================================================
-- HABITACIONES
-- =========================================================

CREATE TABLE IF NOT EXISTS client_00000000.habitaciones (
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
ON client_00000000.habitaciones(estado);


DROP TRIGGER IF EXISTS trg_habitaciones_updated_at
ON client_00000000.habitaciones;

CREATE TRIGGER trg_habitaciones_updated_at
BEFORE UPDATE ON client_00000000.habitaciones
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


ALTER TABLE client_00000000.habitaciones
ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_members_habitaciones_select"
ON client_00000000.habitaciones
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


CREATE POLICY "tenant_members_habitaciones_insert"
ON client_00000000.habitaciones
FOR INSERT
TO authenticated
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


CREATE POLICY "tenant_members_habitaciones_update"
ON client_00000000.habitaciones
FOR UPDATE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
)
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


CREATE POLICY "tenant_members_habitaciones_delete"
ON client_00000000.habitaciones
FOR DELETE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


-- =========================================================
-- VOUCHERS
-- =========================================================

CREATE TABLE IF NOT EXISTS client_00000000.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    base64 TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


ALTER TABLE client_00000000.vouchers
ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_members_vouchers_select"
ON client_00000000.vouchers
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


CREATE POLICY "tenant_members_vouchers_insert"
ON client_00000000.vouchers
FOR INSERT
TO authenticated
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


CREATE POLICY "tenant_members_vouchers_update"
ON client_00000000.vouchers
FOR UPDATE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
)
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


CREATE POLICY "tenant_members_vouchers_delete"
ON client_00000000.vouchers
FOR DELETE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


-- =========================================================
-- RESERVAS
-- =========================================================

CREATE TABLE IF NOT EXISTS client_00000000.reservas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    habitacion_id UUID NOT NULL
        REFERENCES client_00000000.habitaciones(id),

    cliente_id UUID NOT NULL
        REFERENCES client_00000000.clientes(id),

    voucher_id UUID
        REFERENCES client_00000000.vouchers(id)
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
ON client_00000000.reservas(habitacion_id);


CREATE INDEX IF NOT EXISTS idx_reservas_cliente
ON client_00000000.reservas(cliente_id);


CREATE INDEX IF NOT EXISTS idx_reservas_fecha
ON client_00000000.reservas(
    check_in,
    check_out
);


CREATE INDEX IF NOT EXISTS idx_reservas_estado
ON client_00000000.reservas(estado);


CREATE UNIQUE INDEX IF NOT EXISTS idx_reservas_voucher
ON client_00000000.reservas(voucher_id)
WHERE voucher_id IS NOT NULL;


DROP TRIGGER IF EXISTS trg_reservas_updated_at
ON client_00000000.reservas;

CREATE TRIGGER trg_reservas_updated_at
BEFORE UPDATE ON client_00000000.reservas
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


ALTER TABLE client_00000000.reservas
ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_members_reservas_select"
ON client_00000000.reservas
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


CREATE POLICY "tenant_members_reservas_insert"
ON client_00000000.reservas
FOR INSERT
TO authenticated
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


CREATE POLICY "tenant_members_reservas_update"
ON client_00000000.reservas
FOR UPDATE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
)
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


CREATE POLICY "tenant_members_reservas_delete"
ON client_00000000.reservas
FOR DELETE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


-- =========================================================
-- EVITAR RESERVAS SOLAPADAS
-- =========================================================

ALTER TABLE client_00000000.reservas
DROP CONSTRAINT IF EXISTS evitar_reservas_solapadas;


ALTER TABLE client_00000000.reservas
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
-- HUÉSPEDES DE UNA RESERVA
-- =========================================================

CREATE TABLE IF NOT EXISTS client_00000000.reserva_huespedes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    reserva_id UUID NOT NULL
        REFERENCES client_00000000.reservas(id)
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
ON client_00000000.reserva_huespedes(reserva_id);


ALTER TABLE client_00000000.reserva_huespedes
ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_members_reserva_huespedes_select"
ON client_00000000.reserva_huespedes
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


CREATE POLICY "tenant_members_reserva_huespedes_insert"
ON client_00000000.reserva_huespedes
FOR INSERT
TO authenticated
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


CREATE POLICY "tenant_members_reserva_huespedes_update"
ON client_00000000.reserva_huespedes
FOR UPDATE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
)
WITH CHECK (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);


CREATE POLICY "tenant_members_reserva_huespedes_delete"
ON client_00000000.reserva_huespedes
FOR DELETE
TO authenticated
USING (
    (
        SELECT private.user_is_member_of_schema(
            'client_00000000'
        )
    )
);