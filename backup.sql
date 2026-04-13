--
-- PostgreSQL database dump
--

\restrict SRdX345XFCiCMORRks2bqkvZjbDPZxffmHfLfWedCaHEeC8UQ1cPGUFl6JQAG3z

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: area_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.area_type_enum AS ENUM (
    'final-assy',
    'pre-assy'
);


ALTER TYPE public.area_type_enum OWNER TO postgres;

--
-- Name: shift_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.shift_enum AS ENUM (
    'A',
    'B'
);


ALTER TYPE public.shift_enum OWNER TO postgres;

--
-- Name: signature_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.signature_status_enum AS ENUM (
    '-',
    'OK',
    'NG'
);


ALTER TYPE public.signature_status_enum OWNER TO postgres;

--
-- Name: status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.status_enum AS ENUM (
    'OK',
    'NG',
    '-'
);


ALTER TYPE public.status_enum OWNER TO postgres;

--
-- Name: table_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.table_type_enum AS ENUM (
    'inspector',
    'group-leader'
);


ALTER TYPE public.table_type_enum OWNER TO postgres;

--
-- Name: update_carline_line_mapping_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_carline_line_mapping_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_carline_line_mapping_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: carline_line_mapping; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carline_line_mapping (
    id integer NOT NULL,
    user_id character varying(100) NOT NULL,
    category_code character varying(50) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    conveyor text
);


ALTER TABLE public.carline_line_mapping OWNER TO postgres;

--
-- Name: carline_line_mapping_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.carline_line_mapping_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.carline_line_mapping_id_seq OWNER TO postgres;

--
-- Name: carline_line_mapping_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.carline_line_mapping_id_seq OWNED BY public.carline_line_mapping.id;


--
-- Name: checklist_areas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.checklist_areas (
    id integer NOT NULL,
    category_id integer NOT NULL,
    area_name character varying(100) NOT NULL,
    area_code character varying(50) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.checklist_areas OWNER TO postgres;

--
-- Name: checklist_areas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.checklist_areas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.checklist_areas_id_seq OWNER TO postgres;

--
-- Name: checklist_areas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.checklist_areas_id_seq OWNED BY public.checklist_areas.id;


--
-- Name: checklist_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.checklist_categories (
    id integer NOT NULL,
    category_name character varying(100) NOT NULL,
    category_code character varying(50) NOT NULL,
    table_type public.table_type_enum NOT NULL,
    area_type public.area_type_enum NOT NULL,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    description text
);


ALTER TABLE public.checklist_categories OWNER TO postgres;

--
-- Name: checklist_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.checklist_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.checklist_categories_id_seq OWNER TO postgres;

--
-- Name: checklist_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.checklist_categories_id_seq OWNED BY public.checklist_categories.id;


--
-- Name: checklist_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.checklist_history (
    id integer NOT NULL,
    user_id character varying(100) NOT NULL,
    nik character varying(50) NOT NULL,
    category_id integer NOT NULL,
    item_id integer NOT NULL,
    date_key character varying(10) NOT NULL,
    shift public.shift_enum NOT NULL,
    time_slot character varying(50),
    old_status character varying(10),
    new_status character varying(10),
    action_type character varying(20),
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.checklist_history OWNER TO postgres;

--
-- Name: checklist_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.checklist_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.checklist_history_id_seq OWNER TO postgres;

--
-- Name: checklist_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.checklist_history_id_seq OWNED BY public.checklist_history.id;


--
-- Name: checklist_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.checklist_items (
    id integer NOT NULL,
    category_id integer NOT NULL,
    item_no character varying(10),
    check_point text NOT NULL,
    standard text,
    waktu_check character varying(100),
    shift public.shift_enum NOT NULL,
    machine character varying(100),
    kind character varying(100),
    size character varying(20),
    item_check character varying(255),
    method character varying(100),
    area_tensile boolean DEFAULT false,
    area_cross_section boolean DEFAULT false,
    area_cutting boolean DEFAULT false,
    area_pa boolean DEFAULT false,
    schedule character varying(100),
    tool_type character varying(100),
    control_no character varying(50),
    item_check_desc character varying(255),
    frequency character varying(50),
    judge character varying(50),
    metode_check character varying(100),
    area character varying(100),
    show_in_wp_check boolean DEFAULT false,
    show_in_checker boolean DEFAULT false,
    show_in_visual_1 boolean DEFAULT false,
    show_in_visual_2 boolean DEFAULT false,
    show_in_double_check boolean DEFAULT false,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    area_id integer
);


ALTER TABLE public.checklist_items OWNER TO postgres;

--
-- Name: checklist_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.checklist_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.checklist_items_id_seq OWNER TO postgres;

--
-- Name: checklist_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.checklist_items_id_seq OWNED BY public.checklist_items.id;


--
-- Name: checklist_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.checklist_results (
    id integer NOT NULL,
    user_id character varying(100) NOT NULL,
    nik character varying(50) NOT NULL,
    category_id integer NOT NULL,
    item_id integer NOT NULL,
    date_key character varying(10) NOT NULL,
    shift public.shift_enum NOT NULL,
    time_slot character varying(50) DEFAULT ''::character varying NOT NULL,
    status public.status_enum DEFAULT '-'::public.status_enum NOT NULL,
    ng_description text,
    ng_department character varying(50),
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    area_id integer,
    carline character varying(100),
    line character varying(100),
    ng_photos text,
    specific_area character varying(50) DEFAULT NULL::character varying,
    conveyor text
);


ALTER TABLE public.checklist_results OWNER TO postgres;

--
-- Name: COLUMN checklist_results.ng_photos; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.checklist_results.ng_photos IS 'JSON array of base64-encoded JPEG strings for NG documentation photos';


--
-- Name: checklist_results_backup; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.checklist_results_backup (
    id integer,
    user_id character varying(100),
    nik character varying(50),
    category_id integer,
    item_id integer,
    date_key character varying(10),
    shift public.shift_enum,
    time_slot character varying(50),
    status public.status_enum,
    ng_description text,
    ng_department character varying(50),
    submitted_at timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    area_id integer
);


ALTER TABLE public.checklist_results_backup OWNER TO postgres;

--
-- Name: checklist_results_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.checklist_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.checklist_results_id_seq OWNER TO postgres;

--
-- Name: checklist_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.checklist_results_id_seq OWNED BY public.checklist_results.id;


--
-- Name: checklist_signatures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.checklist_signatures (
    id integer NOT NULL,
    user_id character varying(100) NOT NULL,
    nik character varying(50) NOT NULL,
    category_id integer NOT NULL,
    date_key character varying(10) NOT NULL,
    shift public.shift_enum NOT NULL,
    signature_status public.signature_status_enum DEFAULT '-'::public.signature_status_enum NOT NULL,
    signed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    area_id integer,
    carline character varying(50),
    line character varying(50)
);


ALTER TABLE public.checklist_signatures OWNER TO postgres;

--
-- Name: checklist_signatures_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.checklist_signatures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.checklist_signatures_id_seq OWNER TO postgres;

--
-- Name: checklist_signatures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.checklist_signatures_id_seq OWNED BY public.checklist_signatures.id;


--
-- Name: gauge_checkpoint_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gauge_checkpoint_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gauge_id uuid NOT NULL,
    checkpoint_id uuid NOT NULL,
    user_id character varying(100) NOT NULL,
    date_key character varying(10) NOT NULL,
    shift character varying(1) NOT NULL,
    status character varying(3) NOT NULL,
    notes text,
    checked_at timestamp without time zone DEFAULT now(),
    nik character varying(50),
    CONSTRAINT gauge_checkpoint_results_status_check CHECK (((status)::text = ANY ((ARRAY['OK'::character varying, 'NG'::character varying, '-'::character varying])::text[])))
);


ALTER TABLE public.gauge_checkpoint_results OWNER TO postgres;

--
-- Name: gauge_checkpoints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gauge_checkpoints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gauge_type character varying(100) NOT NULL,
    checkpoint_name character varying(255) NOT NULL,
    checkpoint_order integer NOT NULL,
    is_required boolean DEFAULT true,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.gauge_checkpoints OWNER TO postgres;

--
-- Name: gauge_inspections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gauge_inspections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gauge_id uuid,
    user_id character varying(100),
    date_key date NOT NULL,
    shift public.shift_enum NOT NULL,
    status public.status_enum NOT NULL,
    ng_description text,
    ng_department character varying(50),
    scanned_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.gauge_inspections OWNER TO postgres;

--
-- Name: gauge_qr_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gauge_qr_codes (
    id integer NOT NULL,
    gauge_type_id integer NOT NULL,
    gauge_type_slug character varying(80) NOT NULL,
    gauge_type_name character varying(120) NOT NULL,
    area_type character varying(20) NOT NULL,
    gauge_id character varying(80) NOT NULL,
    qr_value character varying(120) NOT NULL,
    display_name character varying(160) NOT NULL,
    seq_number integer DEFAULT 1 NOT NULL,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_by character varying(60) DEFAULT NULL::character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gauge_qr_codes_area_type_check CHECK (((area_type)::text = ANY ((ARRAY['pre-assy'::character varying, 'final-assy'::character varying])::text[])))
);


ALTER TABLE public.gauge_qr_codes OWNER TO postgres;

--
-- Name: gauge_qr_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gauge_qr_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gauge_qr_codes_id_seq OWNER TO postgres;

--
-- Name: gauge_qr_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gauge_qr_codes_id_seq OWNED BY public.gauge_qr_codes.id;


--
-- Name: gauge_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gauge_types (
    id integer NOT NULL,
    gauge_type_slug character varying(80) NOT NULL,
    gauge_type_name character varying(120) NOT NULL,
    area_type character varying(20) NOT NULL,
    dci_item_id integer NOT NULL,
    abbrev character varying(10) NOT NULL,
    is_active boolean DEFAULT true,
    created_by character varying(60),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT gauge_types_area_type_check CHECK (((area_type)::text = ANY ((ARRAY['pre-assy'::character varying, 'final-assy'::character varying])::text[])))
);


ALTER TABLE public.gauge_types OWNER TO postgres;

--
-- Name: gauge_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gauge_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gauge_types_id_seq OWNER TO postgres;

--
-- Name: gauge_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gauge_types_id_seq OWNED BY public.gauge_types.id;


--
-- Name: gauges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gauges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gauge_code character varying(50) NOT NULL,
    gauge_type character varying(50) NOT NULL,
    gauge_name character varying(100) NOT NULL,
    category_id integer,
    area_id integer,
    calibration_due date,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.gauges OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id character varying(100) NOT NULL,
    username character varying(50) NOT NULL,
    full_name character varying(100) NOT NULL,
    nik character varying(50) NOT NULL,
    department character varying(50) NOT NULL,
    role character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_login timestamp without time zone,
    CONSTRAINT check_department CHECK (((department)::text = ANY ((ARRAY['quality-assurance'::character varying, 'admin'::character varying, 'k3'::character varying])::text[]))),
    CONSTRAINT check_role CHECK (((role)::text = ANY ((ARRAY['group-leader-qa'::character varying, 'inspector-qa'::character varying, 'admin'::character varying, 'eso'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: carline_line_mapping id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carline_line_mapping ALTER COLUMN id SET DEFAULT nextval('public.carline_line_mapping_id_seq'::regclass);


--
-- Name: checklist_areas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_areas ALTER COLUMN id SET DEFAULT nextval('public.checklist_areas_id_seq'::regclass);


--
-- Name: checklist_categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_categories ALTER COLUMN id SET DEFAULT nextval('public.checklist_categories_id_seq'::regclass);


--
-- Name: checklist_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_history ALTER COLUMN id SET DEFAULT nextval('public.checklist_history_id_seq'::regclass);


--
-- Name: checklist_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_items ALTER COLUMN id SET DEFAULT nextval('public.checklist_items_id_seq'::regclass);


--
-- Name: checklist_results id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_results ALTER COLUMN id SET DEFAULT nextval('public.checklist_results_id_seq'::regclass);


--
-- Name: checklist_signatures id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_signatures ALTER COLUMN id SET DEFAULT nextval('public.checklist_signatures_id_seq'::regclass);


--
-- Name: gauge_qr_codes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauge_qr_codes ALTER COLUMN id SET DEFAULT nextval('public.gauge_qr_codes_id_seq'::regclass);


--
-- Name: gauge_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauge_types ALTER COLUMN id SET DEFAULT nextval('public.gauge_types_id_seq'::regclass);


--
-- Data for Name: carline_line_mapping; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.carline_line_mapping VALUES (10, 'user_1770797408736_j9ymegj', 'pre-assy-daily-check-ins', false, '2026-04-05 05:49:45.101182', '2026-04-09 06:59:55.838395', 'CONV-1');
INSERT INTO public.carline_line_mapping VALUES (11, 'user_1770696171875_bwjljww', 'final-assy-inspector', false, '2026-04-09 04:41:01.058511', '2026-04-09 07:03:26.774419', 'CONV-3');
INSERT INTO public.carline_line_mapping VALUES (12, 'user_1770696171875_bwjljww', 'final-assy-inspector', false, '2026-04-09 07:03:46.34265', '2026-04-09 07:26:16.347376', 'CONV-1');
INSERT INTO public.carline_line_mapping VALUES (15, 'user_1770797408736_j9ymegj', 'pre-assy-daily-check-ins', true, '2026-04-10 10:59:39.575881', '2026-04-10 10:59:39.575881', 'TEST-01');
INSERT INTO public.carline_line_mapping VALUES (16, 'user_1770797408736_j9ymegj', 'pre-assy-daily-check-ins', true, '2026-04-11 17:19:52.345826', '2026-04-11 17:19:52.345826', 'NN-1');
INSERT INTO public.carline_line_mapping VALUES (13, 'user_1770696171875_bwjljww', 'final-assy-inspector', false, '2026-04-09 07:26:45.371612', '2026-04-11 23:20:48.890967', 'AB01');
INSERT INTO public.carline_line_mapping VALUES (14, 'user_1770696171875_bwjljww', 'final-assy-inspector', false, '2026-04-09 09:03:48.774841', '2026-04-11 23:20:57.413827', 'CONV-09');
INSERT INTO public.carline_line_mapping VALUES (18, 'user_1770797408736_j9ymegj', 'pre-assy-daily-check-ins', true, '2026-04-12 11:29:10.950791', '2026-04-12 11:29:10.950791', 'CONV-9');


--
-- Data for Name: checklist_areas; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.checklist_areas VALUES (5, 2, 'Genba A - Mazda', 'final-assy-insp-genba-a-mazda', 'Area Genba A - Line Mazda', true, 1, '2026-02-23 07:24:41.861687', '2026-03-02 09:22:46.912385');
INSERT INTO public.checklist_areas VALUES (6, 2, 'Genba A - Toyota TRX', 'final-assy-insp-genba-a-toyota-trx', 'Area Genba A - Line Toyota TRX', true, 2, '2026-02-23 07:24:41.861687', '2026-03-02 09:22:46.933556');
INSERT INTO public.checklist_areas VALUES (7, 2, 'Genba B - Nissan', 'final-assy-insp-genba-b-nissan', 'Area Genba B - Line Nissan', true, 3, '2026-02-23 07:24:41.861687', '2026-03-02 09:22:46.937061');
INSERT INTO public.checklist_areas VALUES (8, 2, 'Genba C - Corola', 'final-assy-insp-genba-c-corola', 'Area Genba C - Line Corola', true, 4, '2026-02-23 07:24:41.861687', '2026-03-02 09:22:46.940643');
INSERT INTO public.checklist_areas VALUES (26, 2, 'Genba C - TNGA', 'final-assy-insp-genba-c-tnga', 'Area Genba C - Line TNGA', true, 5, '2026-03-02 09:22:46.943041', '2026-03-02 09:22:46.943041');
INSERT INTO public.checklist_areas VALUES (1, 1, 'Genba A - Mazda', 'final-assy-gl-genba-a-mazda', 'Area Genba A - Line Mazda', true, 1, '2026-02-23 07:24:41.811875', '2026-03-02 09:22:46.958779');
INSERT INTO public.checklist_areas VALUES (2, 1, 'Genba A - Toyota TRX', 'final-assy-gl-genba-a-toyota-trx', 'Area Genba A - Line Toyota TRX', true, 2, '2026-02-23 07:24:41.811875', '2026-03-02 09:22:46.961702');
INSERT INTO public.checklist_areas VALUES (3, 1, 'Genba B - Nissan', 'final-assy-gl-genba-b-nissan', 'Area Genba B - Line Nissan', true, 3, '2026-02-23 07:24:41.811875', '2026-03-02 09:22:46.964549');
INSERT INTO public.checklist_areas VALUES (4, 1, 'Genba C - Corola', 'final-assy-gl-genba-c-corola', 'Area Genba C - Line Corola', true, 4, '2026-02-23 07:24:41.811875', '2026-03-02 09:22:46.967611');
INSERT INTO public.checklist_areas VALUES (27, 1, 'Genba C - TNGA', 'final-assy-gl-genba-c-tnga', 'Area Genba C - Line TNGA', true, 5, '2026-03-02 09:22:46.969839', '2026-03-02 09:22:46.969839');
INSERT INTO public.checklist_areas VALUES (28, 3, 'Genba A - Mazda', 'pre-assy-gl-genba-a-mazda', 'Area Genba A - Line Mazda', true, 1, '2026-03-04 08:10:23.172443', '2026-03-04 08:10:23.172443');
INSERT INTO public.checklist_areas VALUES (29, 3, 'Genba A - Toyota TRX', 'pre-assy-gl-genba-a-toyota-trx', 'Area Genba A - Line Toyota TRX', true, 2, '2026-03-04 08:10:23.172443', '2026-03-04 08:10:23.172443');
INSERT INTO public.checklist_areas VALUES (30, 3, 'Genba B - Nissan', 'pre-assy-gl-genba-b-nissan', 'Area Genba B - Line Nissan', true, 3, '2026-03-04 08:10:23.172443', '2026-03-04 08:10:23.172443');
INSERT INTO public.checklist_areas VALUES (31, 3, 'Genba C - Corola', 'pre-assy-gl-genba-c-corola', 'Area Genba C - Line Corola', true, 4, '2026-03-04 08:10:23.172443', '2026-03-04 08:10:23.172443');
INSERT INTO public.checklist_areas VALUES (32, 3, 'Genba C - TNGA', 'pre-assy-gl-genba-c-tnga', 'Area Genba C - Line TNGA', true, 5, '2026-03-04 08:10:23.172443', '2026-03-04 08:10:23.172443');
INSERT INTO public.checklist_areas VALUES (33, 4, 'Genba A - Mazda', 'pre-assy-cc-genba-a-mazda', 'Area Genba A - Line Mazda', true, 1, '2026-03-04 08:10:32.499797', '2026-03-04 08:10:32.499797');
INSERT INTO public.checklist_areas VALUES (34, 4, 'Genba A - Toyota TRX', 'pre-assy-cc-genba-a-toyota-trx', 'Area Genba A - Line Toyota TRX', true, 2, '2026-03-04 08:10:32.499797', '2026-03-04 08:10:32.499797');
INSERT INTO public.checklist_areas VALUES (35, 4, 'Genba B - Nissan', 'pre-assy-cc-genba-b-nissan', 'Area Genba B - Line Nissan', true, 3, '2026-03-04 08:10:32.499797', '2026-03-04 08:10:32.499797');
INSERT INTO public.checklist_areas VALUES (36, 4, 'Genba C - Corola', 'pre-assy-cc-genba-c-corola', 'Area Genba C - Line Corola', true, 4, '2026-03-04 08:10:32.499797', '2026-03-04 08:10:32.499797');
INSERT INTO public.checklist_areas VALUES (37, 4, 'Genba C - TNGA', 'pre-assy-cc-genba-c-tnga', 'Area Genba C - Line TNGA', true, 5, '2026-03-04 08:10:32.499797', '2026-03-04 08:10:32.499797');
INSERT INTO public.checklist_areas VALUES (38, 5, 'Genba A - Mazda', 'pre-assy-ins-genba-a-mazda', 'Area Genba A - Line Mazda', true, 1, '2026-03-04 08:14:00.140303', '2026-03-04 08:14:00.140303');
INSERT INTO public.checklist_areas VALUES (39, 5, 'Genba A - Toyota TRX', 'pre-assy-ins-genba-a-toyota-trx', 'Area Genba A - Line Toyota TRX', true, 2, '2026-03-04 08:14:00.140303', '2026-03-04 08:14:00.140303');
INSERT INTO public.checklist_areas VALUES (40, 5, 'Genba B - Nissan', 'pre-assy-ins-genba-b-nissan', 'Area Genba B - Line Nissan', true, 3, '2026-03-04 08:14:00.140303', '2026-03-04 08:14:00.140303');
INSERT INTO public.checklist_areas VALUES (41, 5, 'Genba C - Corola', 'pre-assy-ins-genba-c-corola', 'Area Genba C - Line Corola', true, 4, '2026-03-04 08:14:00.140303', '2026-03-04 08:14:00.140303');
INSERT INTO public.checklist_areas VALUES (42, 5, 'Genba C - TNGA', 'pre-assy-ins-genba-c-tnga', 'Area Genba C - Line TNGA', true, 5, '2026-03-04 08:14:00.140303', '2026-03-04 08:14:00.140303');
INSERT INTO public.checklist_areas VALUES (43, 6, 'Genba A - Mazda', 'pre-assy-tool-genba-a-mazda', 'Area Genba A - Line Mazda', true, 1, '2026-03-04 08:15:14.764711', '2026-03-04 08:15:14.764711');
INSERT INTO public.checklist_areas VALUES (44, 6, 'Genba A - Toyota TRX', 'pre-assy-tool-genba-a-toyota-trx', 'Area Genba A - Line Toyota TRX', true, 2, '2026-03-04 08:15:14.764711', '2026-03-04 08:15:14.764711');
INSERT INTO public.checklist_areas VALUES (45, 6, 'Genba B - Nissan', 'pre-assy-tool-genba-b-nissan', 'Area Genba B - Line Nissan', true, 3, '2026-03-04 08:15:14.764711', '2026-03-04 08:15:14.764711');
INSERT INTO public.checklist_areas VALUES (46, 6, 'Genba C - Corola', 'pre-assy-tool-genba-c-corola', 'Area Genba C - Line Corola', true, 4, '2026-03-04 08:15:14.764711', '2026-03-04 08:15:14.764711');
INSERT INTO public.checklist_areas VALUES (47, 6, 'Genba C - TNGA', 'pre-assy-tool-genba-c-tnga', 'Area Genba C - Line TNGA', true, 5, '2026-03-04 08:15:14.764711', '2026-03-04 08:15:14.764711');
INSERT INTO public.checklist_areas VALUES (48, 7, 'Genba A - Mazda', 'pre-assy-jig-genba-a-mazda', 'Area Genba A - Line Mazda', true, 1, '2026-03-04 08:15:23.627982', '2026-03-04 08:15:23.627982');
INSERT INTO public.checklist_areas VALUES (49, 7, 'Genba A - Toyota TRX', 'pre-assy-jig-genba-a-toyota-trx', 'Area Genba A - Line Toyota TRX', true, 2, '2026-03-04 08:15:23.627982', '2026-03-04 08:15:23.627982');
INSERT INTO public.checklist_areas VALUES (50, 7, 'Genba B - Nissan', 'pre-assy-jig-genba-b-nissan', 'Area Genba B - Line Nissan', true, 3, '2026-03-04 08:15:23.627982', '2026-03-04 08:15:23.627982');
INSERT INTO public.checklist_areas VALUES (51, 7, 'Genba C - Corola', 'pre-assy-jig-genba-c-corola', 'Area Genba C - Line Corola', true, 4, '2026-03-04 08:15:23.627982', '2026-03-04 08:15:23.627982');
INSERT INTO public.checklist_areas VALUES (52, 7, 'Genba C - TNGA', 'pre-assy-jig-genba-c-tnga', 'Area Genba C - Line TNGA', true, 5, '2026-03-04 08:15:23.627982', '2026-03-04 08:15:23.627982');


--
-- Data for Name: checklist_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.checklist_categories VALUES (1, 'Daily Check Group Leader Final Assy', 'final-assy-gl', 'group-leader', 'final-assy', true, 1, '2026-02-10 11:55:32.471988', NULL);
INSERT INTO public.checklist_categories VALUES (2, 'Daily Check Inspector Final Assy', 'final-assy-inspector', 'inspector', 'final-assy', true, 2, '2026-02-10 11:55:32.471988', NULL);
INSERT INTO public.checklist_categories VALUES (3, 'Daily Check Group Leader Pre Assy', 'pre-assy-daily-gl', 'group-leader', 'pre-assy', true, 3, '2026-02-11 07:48:51.400478', NULL);
INSERT INTO public.checklist_categories VALUES (4, 'Call Check CC & Stripping GL Pre Assy', 'pre-assy-cc-stripping-gl', 'group-leader', 'pre-assy', true, 4, '2026-02-11 07:48:51.400478', NULL);
INSERT INTO public.checklist_categories VALUES (5, 'Daily Check Ins. Inspector Pre Assy', 'pre-assy-daily-check-ins', 'inspector', 'pre-assy', true, 5, '2026-02-11 07:48:51.400478', NULL);
INSERT INTO public.checklist_categories VALUES (6, 'Check Sheet Control Remove Tool', 'pre-assy-cs-remove-tool', 'inspector', 'pre-assy', true, 6, '2026-02-11 07:48:51.400478', NULL);
INSERT INTO public.checklist_categories VALUES (7, 'Daily Check Pressure Jig Inspector Pre Assy', 'pre-assy-pressure-jig', 'inspector', 'pre-assy', true, 7, '2026-02-11 07:48:51.400478', NULL);


--
-- Data for Name: checklist_history; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: checklist_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.checklist_items VALUES (100, 1, '', 'Check ESO ( setiap hari selasa dan kamis )', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 100, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (101, 1, '', 'Check ESO ( setiap hari selasa dan kamis )', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 101, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (1000, 2, '1', 'ADA NOMOR REGISTER', NULL, NULL, 'A', NULL, NULL, NULL, 'PIPO', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'CHECKER', false, true, false, false, false, true, 1, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1001, 2, '1', 'PIPO DALAM KONDISI BAIK DAN TIDAK RUSAK', NULL, NULL, 'A', NULL, NULL, NULL, 'PIPO', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'CHECKER', false, true, false, false, false, true, 2, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1002, 2, '2', 'ADA NOMOR REGISTER + KALIBRASI TIDAK EXPIRED', NULL, NULL, 'A', NULL, NULL, NULL, 'ROLL METER / MISTAR BAJA', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'CHECKER', false, false, true, true, false, true, 3, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1003, 2, '2', 'GARIS ANGKA TERBACA DENGAN JELAS / TIDAK BERKARAT', NULL, NULL, 'A', NULL, NULL, NULL, 'ROLL METER / MISTAR BAJA', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'CHECKER', false, false, true, true, false, true, 4, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1004, 2, '2', 'ROLLMETER / MISTAR BAJA DALAM KONDISI BAIK DAN TIDAK RUSAK', NULL, NULL, 'A', NULL, NULL, NULL, 'ROLL METER / MISTAR BAJA', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'CHECKER', false, false, true, true, false, true, 5, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1005, 2, '3', 'ADA NOMOR REGISTER + VERIFIKASI TIDAK EXPIRED', NULL, NULL, 'A', NULL, NULL, NULL, 'GO NO GO', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'CHECKER', false, true, false, false, false, true, 6, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1006, 2, '3', 'TIDAK ADA SKRUP YANG KENDOR / HILANG', NULL, NULL, 'A', NULL, NULL, NULL, 'GO NO GO', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'CHECKER', false, true, false, false, false, true, 7, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1007, 2, '3', 'KONDISI GO NO GO DALAM KEADAAN BAIK & BAGIAN BELAKANG (WIRE) DILINDUNGI TAPE / SPIRAL', NULL, NULL, 'A', NULL, NULL, NULL, 'GO NO GO', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'CHECKER', false, true, false, false, false, true, 8, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (5, 1, '3', 'Torque wrench ada nomor registrasi & kalibrasi tidak expired', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual Torque Wrench', NULL, false, false, false, false, false, true, 5, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (6, 1, '3', 'Torque wrench ada nomor registrasi & kalibrasi tidak expired', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual Torque Wrench', NULL, false, false, false, false, false, true, 6, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (7, 1, '3', 'Jarum penunjukan cocok dengan titik nol dan semua bagian torque wrench tidak ada yang rusak', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual Torque Wrench', NULL, false, false, false, false, false, true, 7, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (8, 1, '3', 'Jarum penunjukan cocok dengan titik nol dan semua bagian torque wrench tidak ada yang rusak', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual Torque Wrench', NULL, false, false, false, false, false, true, 8, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (9, 1, '4', 'Kondisi tool dan gauge di area inspection tidak ada yang rusak atau hilang dan ada identitasnya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual Tool / Gauge', NULL, false, false, false, false, false, true, 9, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (21, 1, '10', 'Harness defect di hanger merah dipasang defect tag dan pengisian defect tag sudah dilakukan dengan benar', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Deffect Tag', NULL, false, false, false, false, false, true, 21, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (22, 1, '10', 'Harness defect di hanger merah dipasang defect tag dan pengisian defect tag sudah dilakukan dengan benar', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Deffect Tag', NULL, false, false, false, false, false, true, 22, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (23, 1, '11', 'Identitas Assy number pada visual board sudah update sesuai D/C terakhir', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual', NULL, false, false, false, false, false, true, 23, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (24, 1, '11', 'Identitas Assy number pada visual board sudah update sesuai D/C terakhir', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual', NULL, false, false, false, false, false, true, 24, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (31, 1, '15', 'Stop kontak dalam keadaan bersih tidak berdebu dan lubang yang tidak dipergunakan ditutup dengan cover (SAFETY)', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual', NULL, false, false, false, false, false, true, 31, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (32, 1, '15', 'Stop kontak dalam keadaan bersih tidak berdebu dan lubang yang tidak dipergunakan ditutup dengan cover (SAFETY)', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual', NULL, false, false, false, false, false, true, 32, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (33, 1, '16', 'Memastikan semua inspector menggunakan penutup kepala (Topi / Jilbab)', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual', NULL, false, false, false, false, false, true, 33, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (34, 1, '16', 'Memastikan semua inspector menggunakan penutup kepala (Topi / Jilbab)', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual', NULL, false, false, false, false, false, true, 34, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (3, 1, '2', 'Dilakukan pengecheckan HLC checker fixture dengan alignment gauge oleh inspector checker di akhir shift / checker fixture tidak terpakai', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Sheet HLC Checker', NULL, false, false, false, false, false, true, 3, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (37, 1, '18', 'Dummy Sample OK & N-OK Air Checker di area Sigage ada no registrasi, verifikasi tidak expired serta dalam kondisi baik dan tidak rusak', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual', NULL, false, false, false, false, false, true, 37, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (11, 1, '5', 'Setting connector ke checker fixture dilakukan dengan hati-hati, tidak menimbulkan defect damaged connector / bent terminal', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'QA-ACL-FA-IS-046', NULL, false, false, false, false, false, true, 11, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (12, 1, '5', 'Setting connector ke checker fixture dilakukan dengan hati-hati, tidak menimbulkan defect damaged connector / bent terminal', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'QA-ACL-FA-IS-046', NULL, false, false, false, false, false, true, 12, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (13, 1, '6', 'Inspection board dipasang cover jika tidak ada loading', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual Kondisi Board', NULL, false, false, false, false, false, true, 13, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (14, 1, '6', 'Inspection board dipasang cover jika tidak ada loading', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual Kondisi Board', NULL, false, false, false, false, false, true, 14, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (15, 1, '7', 'Box / politener harness finish good yang quantity-nya tidak standard diberi identitas yang jelas', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Ada Identitas Qty Tidak Standard', NULL, false, false, false, false, false, true, 15, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (16, 1, '7', 'Box / politener harness finish good yang quantity-nya tidak standard diberi identitas yang jelas', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Ada Identitas Qty Tidak Standard', NULL, false, false, false, false, false, true, 16, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (17, 1, '8', 'Box / politener pada saat proses dipasang tutup pada bagian atasnya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual Polinter', NULL, false, false, false, false, false, true, 17, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (18, 1, '8', 'Box / politener pada saat proses dipasang tutup pada bagian atasnya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual Polinter', NULL, false, false, false, false, false, true, 18, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (19, 1, '9', 'Pengisian LKI dan DP oleh inspector sudah dilakukan dengan benar', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual LKI', NULL, false, false, false, false, false, true, 19, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (27, 1, '13', 'Inspection point / Important point yang dipasang tidak ada yang rusak dan up to date, check area Sub Assy sampai Receiving Inspection', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check important Point', NULL, false, false, false, false, false, true, 27, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (29, 1, '14', 'Inspector bekerja sesuai dengan SWCT', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'SWCT Inspector', NULL, false, false, false, false, false, true, 29, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (30, 1, '14', 'Inspector bekerja sesuai dengan SWCT', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'SWCT Inspector', NULL, false, false, false, false, false, true, 30, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (35, 1, '17', 'Cek Magic Pile yang digunakan di area inspeksi & produksi dalam kondisi baik (tidak sobek, tidak berserabut & resleting dalam kondisi baik)', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual', NULL, false, false, false, false, false, true, 35, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (25, 1, '12', 'Cek license card inspector (ada license card, tidak rusak, tidak expired, terpasang dengan benar)', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual', NULL, false, false, false, false, false, true, 25, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (26, 1, '12', 'Cek license card inspector (ada license card, tidak rusak, tidak expired, terpasang dengan benar)', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual', NULL, false, false, false, false, false, true, 26, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (1008, 2, '3', 'ADA STIKER WARNA HIJAU PADA GO NO GO TERMINAL (M TERMINAL) DAN TIDAK LEPAS', NULL, NULL, 'A', NULL, NULL, NULL, 'GO NO GO', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'CHECKER', false, true, false, false, false, true, 9, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1009, 2, '3', 'KONDISI GO NO GO TERMINAL DALAM KEADAAN OK (TIDAK AUS, TIDAK BENT, TIDAK PATAH, TIDAK DEFORMASI)', NULL, NULL, 'A', NULL, NULL, NULL, 'GO NO GO', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'CHECKER', false, true, false, false, false, true, 10, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1010, 2, '3', 'BISA MENDETEKSI KONDISI OK DAN N-OK MELALUI SAMPLE OK DAN N-OK', NULL, NULL, 'A', NULL, NULL, NULL, 'GO NO GO', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'DICOBA', 'CHECKER', false, true, false, false, false, true, 11, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1011, 2, '4', 'ADA NOMOR REGISTER + VERIFIKASI TIDAK EXPIRED', NULL, NULL, 'A', NULL, NULL, NULL, 'PUSH GAUGE RB', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'CHECKER', false, true, false, false, false, true, 12, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1012, 2, '4', 'TIDAK ADA SKRUP YANG KENDOR / HILANG', NULL, NULL, 'A', NULL, NULL, NULL, 'PUSH GAUGE RB', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'CHECKER', false, true, false, false, false, true, 13, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1013, 2, '4', 'ADA BANTALAN KARET (CUSHION) PADA UJUNGNYA', NULL, NULL, 'A', NULL, NULL, NULL, 'PUSH GAUGE RB', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'CHECKER', false, true, false, false, false, true, 14, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1014, 2, '4', 'LAMPU INDIKATOR MENYALA', NULL, NULL, 'A', NULL, NULL, NULL, 'PUSH GAUGE RB', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'CHECKER', false, true, false, false, false, true, 15, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1015, 2, '5', 'ADA NOMOR REGISTER + VERIFIKASI TIDAK EXPIRED', NULL, NULL, 'A', NULL, NULL, NULL, 'DUMMY SAMPLE OK & N-OK', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'CHECKER', false, true, false, false, false, true, 16, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1016, 2, '5', 'SAMPLE DALAM KONDISI BAIK DAN TIDAK RUSAK', NULL, NULL, 'A', NULL, NULL, NULL, 'DUMMY SAMPLE OK & N-OK', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'CHECKER', false, true, false, false, false, true, 17, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1017, 2, '6', 'IMPORTANT/INSPECTION POINT TERBACA DENGAN JELAS DAN TIDAK RUSAK', NULL, NULL, 'A', NULL, NULL, NULL, 'IMPORTANT / INSPECTION POINT', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'VISUAL 1', false, false, true, false, false, true, 18, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1018, 2, '6', 'ISI IMPORTANT/INSPECTION POINT SESUAI DENGAN LEVEL TERBARU', NULL, NULL, 'A', NULL, NULL, NULL, 'IMPORTANT / INSPECTION POINT', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'VISUAL 1', false, false, true, false, false, true, 19, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1019, 2, '7', 'ADA NOMOR REGISTER + VERIFIKASI TIDAK EXPIRED', NULL, NULL, 'A', NULL, NULL, NULL, 'FUSE PLATE', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'VISUAL 1', false, true, true, true, false, true, 20, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1020, 2, '7', 'WARNA DAN ANGKA ADA DAN TERBACA DENGAN JELAS', NULL, NULL, 'A', NULL, NULL, NULL, 'FUSE PLATE', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'VISUAL 1', false, true, true, true, false, true, 21, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1021, 2, '7', 'FUSE PLATE DALAM KONDISI BAIK DAN TIDAK RUSAK', NULL, NULL, 'A', NULL, NULL, NULL, 'FUSE PLATE', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'VISUAL 1', false, true, true, true, false, true, 22, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1022, 2, '7', 'FUSE INSERTION / PENEKAN FUSE DALAM KONDISI OK', NULL, NULL, 'A', NULL, NULL, NULL, 'FUSE PLATE', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'VISUAL 1', false, true, true, true, false, true, 23, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1023, 2, '8', 'LAMPU LED KONDISI MENYALA', NULL, NULL, 'A', NULL, NULL, NULL, 'LAMPU NAVIGASI', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'VISUAL 1', false, false, true, true, false, true, 24, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1024, 2, '8', 'COVER LED TIDAK HILANG ATAU PECAH', NULL, NULL, 'A', NULL, NULL, NULL, 'LAMPU NAVIGASI', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'VISUAL 1', false, false, true, true, false, true, 25, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1025, 2, '8', 'LAMPU LED TERPASANG SEMPURNA/TIDAK LEPAS', NULL, NULL, 'A', NULL, NULL, NULL, 'LAMPU NAVIGASI', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'VISUAL 1', false, false, true, true, false, true, 26, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1026, 2, '9', 'LAMPU LED KONDISI MENYALA', NULL, NULL, 'A', NULL, NULL, NULL, 'TAPE NAVIGASI', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'VISUAL 2', false, true, true, true, false, true, 27, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1027, 2, '9', 'KONDISI SWITCH TIDAK RUSAK', NULL, NULL, 'A', NULL, NULL, NULL, 'TAPE NAVIGASI', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'VISUAL 2', false, true, true, true, false, true, 28, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1028, 2, '9', 'ADA IDENTITAS TAPE', NULL, NULL, 'A', NULL, NULL, NULL, 'TAPE NAVIGASI', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'VISUAL 2', false, true, true, true, false, true, 29, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1029, 2, '10', 'TIDAK ADA SKRUP & BAUT YANG MENONJOL DAN TAJAM', NULL, NULL, 'A', NULL, NULL, NULL, 'INSPECTION BOARD', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'VISUAL 2', false, true, true, true, true, true, 30, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1030, 2, '10', 'APPROVAL SHEET SESUAI LEVEL TERAKHIR', NULL, NULL, 'A', NULL, NULL, NULL, 'INSPECTION BOARD', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'VISUAL 2', false, true, true, true, true, true, 31, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1031, 2, '10', 'APPROVAL SHEET DITANDA TANGANI QA', NULL, NULL, 'A', NULL, NULL, NULL, 'INSPECTION BOARD', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'VISUAL 2', false, true, true, true, true, true, 32, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1032, 2, '10', 'KONDISI SAMPLE DAN PLASTIK TIDAK RUSAK', NULL, NULL, 'A', NULL, NULL, NULL, 'INSPECTION BOARD', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'VISUAL 2', false, true, true, true, true, true, 33, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1033, 2, '11', 'BOTOL TIDAK BOCOR / RUSAK & ADA STICKER B3', NULL, NULL, 'A', NULL, NULL, NULL, 'DRY SURF', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'DOUBLE CHECK (RI)', false, false, false, true, true, true, 34, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1034, 2, '11', 'SPONS / KUAS TIDAK RUSAK / AUS', NULL, NULL, 'A', NULL, NULL, NULL, 'DRY SURF', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'DOUBLE CHECK (RI)', false, false, false, true, true, true, 35, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1035, 2, '11', 'ADA TANDA MAX & MIN PADA BOTOL DAN ISI CAIRAN SESUAI RENTANG MAX DAN MIN', NULL, NULL, 'A', NULL, NULL, NULL, 'DRY SURF', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'DOUBLE CHECK (RI)', false, false, false, true, true, true, 36, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1036, 2, '12', 'KONDISI TUTUP POLYTAINER TIDAK RUSAK DAN JUMLAHNYA SUDAH SESUAI', NULL, NULL, 'A', NULL, NULL, NULL, 'PACKING', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'DOUBLE CHECK (RI)', false, false, false, false, true, true, 37, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1037, 2, '12', 'HT SCAN BISA BERFUNGSI DENGAN BAIK', NULL, NULL, 'A', NULL, NULL, NULL, 'PACKING', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'DOUBLE CHECK (RI)', false, false, false, false, true, true, 38, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1038, 2, '12', 'MAJUN DAN SIKAT POLYTAINER ADA PADA TEMPATNYA DAN SESUAI DENGAN JUMLAHNYA', NULL, NULL, 'A', NULL, NULL, NULL, 'PACKING', NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'VISUAL', 'DOUBLE CHECK (RI)', false, false, false, false, true, true, 39, '2026-02-10 14:32:00.070886', '2026-02-10 14:32:00.070886', NULL);
INSERT INTO public.checklist_items VALUES (1039, 3, '1', 'Inspector check product yang mengalami perubahan 4M dan hasilnya di up date di C/S 4M', 'Check pengisian C/S 4M', 'Setiap Hari', 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 1, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1040, 3, '1', 'Pengisian LKI di lakukan setelah proses inspection dan di isi secara benar', 'Check actual pengisian LKI (Sampling check min. 3 inspector)', 'Setiap Hari', 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 2, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1041, 3, '2', 'Circuit defect yang ada di hanger merah sudah terpasang defective tag', ' ', 'Setiap Hari', 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 3, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1042, 3, '2', 'Inspector check visual terminal dengan memisahkan 1 lot menjadi beberapa bagian', 'Sesuai IS no. QA-ACL-PA-IS-031', 'Setiap Hari', 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 4, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1043, 3, '3', 'Cek implementasi pengecekan circuit A/B (Countermeasure claim no stripping J53C)', 'Sesuai IS no. QA-ACL-PA-IS-031 hal. 4', 'Setiap Hari', 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 5, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1044, 3, '3', 'Circuit di supply dan di letakan di store sesuai dengan address', 'Sampling check circuit yang ada di store', 'Setiap Senin & Kamis', 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 6, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1045, 3, '4', 'Jumlah circuit di troli tidak melebihi kapasitas trolly', 'Check kondisi actual (sampling check min. 3 inspector)', 'Setiap Senin & Kamis', 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 7, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1046, 3, '4', 'Cup di trolly di tempatkan sesuai dengan tempat yang di sediakan', 'Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012', 'Setiap Selasa & Jumat', 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 8, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1047, 3, '5', 'Cek kondisi Micrometer, Gauge, Tool dan Alat Potong', 'Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012', 'Setiap Selasa & Jumat', 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 9, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1048, 3, '5', 'Daily Check Inspector sudah diisi dan update sesuai kondisi actual', 'Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012', 'Setiap Selasa & Jumat', 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 10, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1049, 3, '6', 'Tidak ada bagian trolly inspector yang rusak', 'Check kondisi actual', '1 Inspector / Minggu', 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 11, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1050, 3, '6', 'Inspector bekerja sesuai dengan urutan yang ada di SWCT', 'Check actual dengan SWCT', '1 Inspector / Minggu', 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 12, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1051, 3, '7', 'Stop kontak dalam keadaan bersih tidak berdebu', 'Check kondisi actual', 'Setiap Selasa', 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 13, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1052, 3, '7', 'Memastikan semua inspector menggunakan penutup kepala', 'Check kondisi actual', 'Setiap Hari', 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 14, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1053, 3, '8', 'Inspector check product yang mengalami perubahan 4M dan hasilnya di up date di C/S 4M', 'Check pengisian C/S 4M', 'Setiap Hari', 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 15, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1054, 3, '8', 'Pengisian LKI di lakukan setelah proses inspection dan di isi secara benar', 'Check actual pengisian LKI (Sampling check min. 3 inspector)', 'Setiap Hari', 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 16, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1055, 3, '9', 'Circuit defect yang ada di hanger merah sudah terpasang defective tag', ' ', 'Setiap Hari', 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 17, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1056, 3, '9', 'Inspector check visual terminal dengan memisahkan 1 lot menjadi beberapa bagian', 'Sesuai IS no. QA-ACL-PA-IS-031', 'Setiap Hari', 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 18, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1057, 3, '10', 'Cek implementasi pengecekan circuit A/B (Countermeasure claim no stripping J53C)', 'Sesuai IS no. QA-ACL-PA-IS-031 hal. 4', 'Setiap Hari', 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 19, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1058, 3, '10', 'Circuit di supply dan di letakan di store sesuai dengan address', 'Sampling check circuit yang ada di store', 'Setiap Senin & Kamis', 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 20, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1059, 3, '11', 'Jumlah circuit di troli tidak melebihi kapasitas trolly', 'Check kondisi actual (sampling check min. 3 inspector)', 'Setiap Senin & Kamis', 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 21, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1060, 3, '11', 'Cup di trolly di tempatkan sesuai dengan tempat yang di sediakan', 'Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012', 'Setiap Selasa & Jumat', 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 22, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1061, 3, '12', 'Cek kondisi Micrometer, Gauge, Tool dan Alat Potong', 'Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012', 'Setiap Selasa & Jumat', 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 23, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1062, 3, '12', 'Daily Check Inspector sudah diisi dan update sesuai kondisi actual', 'Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012', 'Setiap Selasa & Jumat', 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 24, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1063, 3, '13', 'Tidak ada bagian trolly inspector yang rusak', 'Check kondisi actual', '1 Inspector / Minggu', 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 25, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1064, 3, '13', 'Inspector bekerja sesuai dengan urutan yang ada di SWCT', 'Check actual dengan SWCT', '1 Inspector / Minggu', 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 26, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1065, 3, '14', 'Stop kontak dalam keadaan bersih tidak berdebu', 'Check kondisi actual', 'Setiap Selasa', 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 27, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1066, 3, '14', 'Memastikan semua inspector menggunakan penutup kepala', 'Check kondisi actual', 'Setiap Hari', 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 28, '2026-02-11 08:07:35.873305', '2026-02-11 08:07:35.873305', NULL);
INSERT INTO public.checklist_items VALUES (1068, 4, '1', 'AC90 TRX 01 - IA-CIVUS - 0.13', NULL, NULL, 'A', 'AC90 TRX 01', 'IA-CIVUS', '0.13', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 1, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1069, 4, '2', 'AC90 TRX 01 - IA-CIVUS - 0.13', NULL, NULL, 'B', 'AC90 TRX 01', 'IA-CIVUS', '0.13', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 2, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1070, 4, '3', 'AC90 TRX 02 - IA-CIVUS - 0.13', NULL, NULL, 'A', 'AC90 TRX 02', 'IA-CIVUS', '0.13', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 3, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1071, 4, '4', 'AC90 TRX 02 - IA-CIVUS - 0.13', NULL, NULL, 'B', 'AC90 TRX 02', 'IA-CIVUS', '0.13', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 4, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1072, 4, '5', 'AC90 TRX 03 - IA-CIVUS - 0.13', NULL, NULL, 'A', 'AC90 TRX 03', 'IA-CIVUS', '0.13', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 5, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1073, 4, '6', 'AC90 TRX 03 - IA-CIVUS - 0.13', NULL, NULL, 'B', 'AC90 TRX 03', 'IA-CIVUS', '0.13', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 6, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1074, 4, '7', 'AC90 TRX 04 - CIVUS - 0.35', NULL, NULL, 'A', 'AC90 TRX 04', 'CIVUS', '0.35', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 7, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1075, 4, '8', 'AC90 TRX 04 - CIVUS - 0.35', NULL, NULL, 'B', 'AC90 TRX 04', 'CIVUS', '0.35', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 8, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1076, 4, '9', 'AC90 TRX 05 - AVSS - 2.0', NULL, NULL, 'A', 'AC90 TRX 05', 'AVSS', '2.0', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 9, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1077, 4, '10', 'AC90 TRX 05 - AVSS - 2.0', NULL, NULL, 'B', 'AC90 TRX 05', 'AVSS', '2.0', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 10, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1078, 4, '11', 'AC90 TRX 06 - ALVUS - 2.0', NULL, NULL, 'A', 'AC90 TRX 06', 'ALVUS', '2.0', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 11, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1079, 4, '12', 'AC90 TRX 06 - ALVUS - 2.0', NULL, NULL, 'B', 'AC90 TRX 06', 'ALVUS', '2.0', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 12, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1080, 4, '13', 'AC90 TRX 06 - ALVUS - 2.5', NULL, NULL, 'A', 'AC90 TRX 06', 'ALVUS', '2.5', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 13, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1081, 4, '14', 'AC90 TRX 06 - ALVUS - 2.5', NULL, NULL, 'B', 'AC90 TRX 06', 'ALVUS', '2.5', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 14, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1082, 4, '15', 'AC90 TRX 07 - ALVUS - 0.75', NULL, NULL, 'A', 'AC90 TRX 07', 'ALVUS', '0.75', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 15, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1083, 4, '16', 'AC90 TRX 07 - ALVUS - 0.75', NULL, NULL, 'B', 'AC90 TRX 07', 'ALVUS', '0.75', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 16, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1084, 4, '17', 'AC90 TRX 07 - ALVUS - 1.25', NULL, NULL, 'A', 'AC90 TRX 07', 'ALVUS', '1.25', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 17, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1085, 4, '18', 'AC90 TRX 07 - ALVUS - 1.25', NULL, NULL, 'B', 'AC90 TRX 07', 'ALVUS', '1.25', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 18, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1086, 4, '19', 'AC90 TRX 08 - ALVUS - 0.5', NULL, NULL, 'A', 'AC90 TRX 08', 'ALVUS', '0.5', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 19, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1087, 4, '20', 'AC90 TRX 08 - ALVUS - 0.5', NULL, NULL, 'B', 'AC90 TRX 08', 'ALVUS', '0.5', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 20, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1088, 4, '21', 'AC90 TRX 08 - ALVUS - 0.75', NULL, NULL, 'A', 'AC90 TRX 08', 'ALVUS', '0.75', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 21, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1089, 4, '22', 'AC90 TRX 08 - ALVUS - 0.75', NULL, NULL, 'B', 'AC90 TRX 08', 'ALVUS', '0.75', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 22, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1090, 4, '23', 'AC90 TRX 09 - ALVUS - 0.5', NULL, NULL, 'A', 'AC90 TRX 09', 'ALVUS', '0.5', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 23, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1091, 4, '24', 'AC90 TRX 09 - ALVUS - 0.5', NULL, NULL, 'B', 'AC90 TRX 09', 'ALVUS', '0.5', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 24, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1092, 4, '25', 'AC90 TRX 10 - CAVS - 0.3', NULL, NULL, 'A', 'AC90 TRX 10', 'CAVS', '0.3', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 25, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1093, 4, '26', 'AC90 TRX 10 - CAVS - 0.3', NULL, NULL, 'B', 'AC90 TRX 10', 'CAVS', '0.3', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 26, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1094, 4, '27', 'AC90 TRX 10 - CAVS - 0.5', NULL, NULL, 'A', 'AC90 TRX 10', 'CAVS', '0.5', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 27, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1095, 4, '28', 'AC90 TRX 10 - CAVS - 0.5', NULL, NULL, 'B', 'AC90 TRX 10', 'CAVS', '0.5', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 28, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1096, 4, '29', 'AC90 TRX 10 - CAVS - 0.85', NULL, NULL, 'A', 'AC90 TRX 10', 'CAVS', '0.85', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 29, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1097, 4, '30', 'AC90 TRX 10 - CAVS - 0.85', NULL, NULL, 'B', 'AC90 TRX 10', 'CAVS', '0.85', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 30, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1098, 4, '31', 'AC90 TRX 10 - AESSX - 0.3', NULL, NULL, 'A', 'AC90 TRX 10', 'AESSX', '0.3', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 31, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1099, 4, '32', 'AC90 TRX 10 - AESSX - 0.3', NULL, NULL, 'B', 'AC90 TRX 10', 'AESSX', '0.3', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 32, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1100, 4, '33', 'AC90 TRX 10 - CIVUS - 0.35', NULL, NULL, 'A', 'AC90 TRX 10', 'CIVUS', '0.35', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 33, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1101, 4, '34', 'AC90 TRX 10 - CIVUS - 0.35', NULL, NULL, 'B', 'AC90 TRX 10', 'CIVUS', '0.35', NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 34, '2026-02-11 08:44:14.836103', '2026-02-11 08:44:14.836103', NULL);
INSERT INTO public.checklist_items VALUES (1244, 5, '1', '1A. TERDAPAT STICKER "E"', NULL, NULL, 'A', NULL, NULL, NULL, 'BOLPOINT & MARKER', 'VISUAL', true, true, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 1, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1245, 5, '1', '1A. TERDAPAT STICKER "E"', NULL, NULL, 'B', NULL, NULL, NULL, 'BOLPOINT & MARKER', 'VISUAL', true, true, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 2, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1246, 5, '2', '2A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED', NULL, NULL, 'A', NULL, NULL, NULL, 'MICROMETER', 'VISUAL', true, false, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 3, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1247, 5, '2', '2A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED', NULL, NULL, 'B', NULL, NULL, NULL, 'MICROMETER', 'VISUAL', true, false, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 4, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1248, 5, '2', '2B. ANGKA TERBACA DENGAN JELAS (LAYAR TIDAK MUNCUL HURUF "B", "H", "INS" atau "P").', NULL, NULL, 'A', NULL, NULL, NULL, 'MICROMETER', 'VISUAL', true, false, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 5, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1249, 5, '2', '2B. ANGKA TERBACA DENGAN JELAS (LAYAR TIDAK MUNCUL HURUF "B", "H", "INS" atau "P").', NULL, NULL, 'B', NULL, NULL, NULL, 'MICROMETER', 'VISUAL', true, false, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 6, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1250, 5, '2', '2C. ZERO SETTING OK (LAYAR MENUNJUKKAN "0.000").', NULL, NULL, 'A', NULL, NULL, NULL, 'MICROMETER', 'VISUAL', true, false, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 7, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1251, 5, '2', '2C. ZERO SETTING OK (LAYAR MENUNJUKKAN "0.000").', NULL, NULL, 'B', NULL, NULL, NULL, 'MICROMETER', 'VISUAL', true, false, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 8, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1252, 5, '2', '2D. KONDISI ANVIL DAN SPINDLE OK (TIDAK ADA KARAT DAN BERPUTAR LONGGAR PADA BAGIAN PENGUKURAN).', NULL, NULL, 'A', NULL, NULL, NULL, 'MICROMETER', 'VISUAL, SENTUH', true, false, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 9, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1253, 5, '2', '2D. KONDISI ANVIL DAN SPINDLE OK (TIDAK ADA KARAT DAN BERPUTAR LONGGAR PADA BAGIAN PENGUKURAN).', NULL, NULL, 'B', NULL, NULL, NULL, 'MICROMETER', 'VISUAL, SENTUH', true, false, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 10, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1254, 5, '2', '2E. BAUT PENGUNCI TIDAK LONGGAR / DOL (CEK TANDA PADA SCREW)', NULL, NULL, 'A', NULL, NULL, NULL, 'MICROMETER', 'VISUAL', true, false, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 11, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1255, 5, '2', '2E. BAUT PENGUNCI TIDAK LONGGAR / DOL (CEK TANDA PADA SCREW)', NULL, NULL, 'B', NULL, NULL, NULL, 'MICROMETER', 'VISUAL', true, false, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 12, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1256, 5, '3', '3A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED', NULL, NULL, 'A', NULL, NULL, NULL, 'CALIPER', 'VISUAL', false, false, false, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 13, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1257, 5, '3', '3A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED', NULL, NULL, 'B', NULL, NULL, NULL, 'CALIPER', 'VISUAL', false, false, false, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 14, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1258, 5, '3', '3B. ZERO SETTING OK (LAYAR MENUNJUKKAN "0.00").', NULL, NULL, 'A', NULL, NULL, NULL, 'CALIPER', 'VISUAL', false, false, false, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 15, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1259, 5, '3', '3B. ZERO SETTING OK (LAYAR MENUNJUKKAN "0.00").', NULL, NULL, 'B', NULL, NULL, NULL, 'CALIPER', 'VISUAL', false, false, false, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 16, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1260, 5, '3', '3C. PENGGESER BERGERAK DENGAN LANCAR, TIDAK ADA BAGIAN YANG DEFORMASI, BERKARAT, RUSAK DAN TIDAK ADA BENDA YANG MENEMPEL PADA BAGIAN PENGUKURAN', NULL, NULL, 'A', NULL, NULL, NULL, 'CALIPER', 'VISUAL, SENTUH', false, false, false, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 17, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1261, 5, '3', '3C. PENGGESER BERGERAK DENGAN LANCAR, TIDAK ADA BAGIAN YANG DEFORMASI, BERKARAT, RUSAK DAN TIDAK ADA BENDA YANG MENEMPEL PADA BAGIAN PENGUKURAN', NULL, NULL, 'B', NULL, NULL, NULL, 'CALIPER', 'VISUAL, SENTUH', false, false, false, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 18, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1262, 5, '4', '4A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED', NULL, NULL, 'A', NULL, NULL, NULL, 'MESIN TENSILE', 'VISUAL', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 19, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1263, 5, '4', '4A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED', NULL, NULL, 'B', NULL, NULL, NULL, 'MESIN TENSILE', 'VISUAL', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 20, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1264, 5, '4', '4B. ANGKA HASIL PENGUKURAN PADA LAYAR TERBACA DENGAN JELAS', NULL, NULL, 'A', NULL, NULL, NULL, 'MESIN TENSILE', 'VISUAL', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 21, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1265, 5, '4', '4B. ANGKA HASIL PENGUKURAN PADA LAYAR TERBACA DENGAN JELAS', NULL, NULL, 'B', NULL, NULL, NULL, 'MESIN TENSILE', 'VISUAL', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 22, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1266, 5, '4', '4C. MESIN TENSILE DALAM KONDISI BAIK DAN BAGIANNYA TIDAK ADA YANG RUSAK', NULL, NULL, 'A', NULL, NULL, NULL, 'MESIN TENSILE', 'VISUAL', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 23, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1267, 5, '4', '4C. MESIN TENSILE DALAM KONDISI BAIK DAN BAGIANNYA TIDAK ADA YANG RUSAK', NULL, NULL, 'B', NULL, NULL, NULL, 'MESIN TENSILE', 'VISUAL', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 24, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1268, 5, '4', '4D. SAAT DI OPERASIKAN TIDAK ADA KONDISI ATAU MUNCUL SUARA YANG ABNORMAL.', NULL, NULL, 'A', NULL, NULL, NULL, 'MESIN TENSILE', 'VISUAL / DI DENGARKAN', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 25, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1269, 5, '4', '4D. SAAT DI OPERASIKAN TIDAK ADA KONDISI ATAU MUNCUL SUARA YANG ABNORMAL.', NULL, NULL, 'B', NULL, NULL, NULL, 'MESIN TENSILE', 'VISUAL / DI DENGARKAN', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 26, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1270, 5, '4', '4E. SAAT DI OPERASIKAN ANGKA PENGUKURAN DI LAYAR STABIL ATAU TIDAK BERUBAH-UBAH', NULL, NULL, 'A', NULL, NULL, NULL, 'MESIN TENSILE', 'VISUAL', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 27, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1271, 5, '4', '4E. SAAT DI OPERASIKAN ANGKA PENGUKURAN DI LAYAR STABIL ATAU TIDAK BERUBAH-UBAH', NULL, NULL, 'B', NULL, NULL, NULL, 'MESIN TENSILE', 'VISUAL', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 28, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1272, 5, '4', '4F. SEBELUM DI LAKUKAN PENGUKURAN, BISA DI SETTING "0" UNTUK ANGKA PENGUKURAN.', NULL, NULL, 'A', NULL, NULL, NULL, 'MESIN TENSILE', 'VISUAL', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 29, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1273, 5, '4', '4F. SEBELUM DI LAKUKAN PENGUKURAN, BISA DI SETTING "0" UNTUK ANGKA PENGUKURAN.', NULL, NULL, 'B', NULL, NULL, NULL, 'MESIN TENSILE', 'VISUAL', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 30, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1274, 5, '4', '4G. PASTIKAN GRIPER BISA BERHENTI PADA POSISI STOPPER YANG DITENTUKAN', NULL, NULL, 'A', NULL, NULL, NULL, 'MESIN TENSILE', 'DICOBA', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 31, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1275, 5, '4', '4G. PASTIKAN GRIPER BISA BERHENTI PADA POSISI STOPPER YANG DITENTUKAN', NULL, NULL, 'B', NULL, NULL, NULL, 'MESIN TENSILE', 'DICOBA', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 32, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1276, 5, '4', '4H. TOMBOL EMERGENCY BISA BERFUNGSI', NULL, NULL, 'A', NULL, NULL, NULL, 'MESIN TENSILE', 'DICOBA', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 33, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1277, 5, '4', '4H. TOMBOL EMERGENCY BISA BERFUNGSI', NULL, NULL, 'B', NULL, NULL, NULL, 'MESIN TENSILE', 'DICOBA', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 34, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1278, 5, '5', '5A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED', NULL, NULL, 'A', NULL, NULL, NULL, 'STEEL RULER', 'VISUAL', false, false, false, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 35, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1279, 5, '5', '5A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED', NULL, NULL, 'B', NULL, NULL, NULL, 'STEEL RULER', 'VISUAL', false, false, false, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 36, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1280, 5, '5', '5B. STEEL RULER TIDAK BERKARAT DAN ANGKA TERBACA DENGAN JELAS', NULL, NULL, 'A', NULL, NULL, NULL, 'STEEL RULER', 'VISUAL', false, false, false, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 37, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1281, 5, '5', '5B. STEEL RULER TIDAK BERKARAT DAN ANGKA TERBACA DENGAN JELAS', NULL, NULL, 'B', NULL, NULL, NULL, 'STEEL RULER', 'VISUAL', false, false, false, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 38, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1282, 5, '6', '6A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED', NULL, NULL, 'A', NULL, NULL, NULL, 'BENT UP/DOWN GAUGE', 'VISUAL', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 39, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1283, 5, '6', '6A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED', NULL, NULL, 'B', NULL, NULL, NULL, 'BENT UP/DOWN GAUGE', 'VISUAL', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 40, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1284, 5, '6', '6B. GAUGE DALAM KONDISI BAIK, TIDAK BENT, TIDAK TAJAM DAN TIDAK RUSAK', NULL, NULL, 'A', NULL, NULL, NULL, 'BENT UP/DOWN GAUGE', 'VISUAL', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 41, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1285, 5, '6', '6B. GAUGE DALAM KONDISI BAIK, TIDAK BENT, TIDAK TAJAM DAN TIDAK RUSAK', NULL, NULL, 'B', NULL, NULL, NULL, 'BENT UP/DOWN GAUGE', 'VISUAL', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 42, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1286, 5, '6', '6C. BISA MENDETEKSI KONDISI OK DAN N-OK MELALUI SAMPLE OK DAN N-OK', NULL, NULL, 'A', NULL, NULL, NULL, 'BENT UP/DOWN GAUGE', 'DICOBA', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 43, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1287, 5, '6', '6C. BISA MENDETEKSI KONDISI OK DAN N-OK MELALUI SAMPLE OK DAN N-OK', NULL, NULL, 'B', NULL, NULL, NULL, 'BENT UP/DOWN GAUGE', 'DICOBA', true, false, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 44, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1288, 5, '7', '7A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED (EXPIRED DATE HANYA UNTUK THICKENESS GAUGE)', NULL, NULL, 'A', NULL, NULL, NULL, 'THICKNESS GAUGE / GO NO GO M TERMINAL', 'VISUAL', true, false, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 45, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1289, 5, '7', '7A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED (EXPIRED DATE HANYA UNTUK THICKENESS GAUGE)', NULL, NULL, 'B', NULL, NULL, NULL, 'THICKNESS GAUGE / GO NO GO M TERMINAL', 'VISUAL', true, false, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 46, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1290, 5, '7', '7B. GAUGE / GO NO GO DALAM KONDISI BAIK, TIDAK BENT, TIDAK TAJAM DAN TIDAK RUSAK', NULL, NULL, 'A', NULL, NULL, NULL, 'THICKNESS GAUGE / GO NO GO M TERMINAL', 'VISUAL', true, false, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 47, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1291, 5, '7', '7B. GAUGE / GO NO GO DALAM KONDISI BAIK, TIDAK BENT, TIDAK TAJAM DAN TIDAK RUSAK', NULL, NULL, 'B', NULL, NULL, NULL, 'THICKNESS GAUGE / GO NO GO M TERMINAL', 'VISUAL', true, false, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 48, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1292, 5, '8', '8A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED', NULL, NULL, 'A', NULL, NULL, NULL, 'POCKET COMPARATOR', 'VISUAL', true, true, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 49, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1293, 5, '8', '8A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED', NULL, NULL, 'B', NULL, NULL, NULL, 'POCKET COMPARATOR', 'VISUAL', true, true, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 50, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1294, 5, '8', '8B. POCKET COMPARATOR DALAM KONDISI BAIK, TIDAK RUSAK DAN BISA MELIHAT SECARA JELAS', NULL, NULL, 'A', NULL, NULL, NULL, 'POCKET COMPARATOR', 'VISUAL', true, true, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 51, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1295, 5, '8', '8B. POCKET COMPARATOR DALAM KONDISI BAIK, TIDAK RUSAK DAN BISA MELIHAT SECARA JELAS', NULL, NULL, 'B', NULL, NULL, NULL, 'POCKET COMPARATOR', 'VISUAL', true, true, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 52, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1296, 5, '9', '9A. TIDAK RUSAK / TERBACA DENGAN JELAS', NULL, NULL, 'A', NULL, NULL, NULL, 'CRIMPING STANDARD & IS', 'VISUAL', true, true, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 53, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1297, 5, '9', '9A. TIDAK RUSAK / TERBACA DENGAN JELAS', NULL, NULL, 'B', NULL, NULL, NULL, 'CRIMPING STANDARD & IS', 'VISUAL', true, true, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 54, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1298, 5, '9', '9B. ADA STAMP CONTROL DAN STAMP "CONFIDENTIAL"', NULL, NULL, 'A', NULL, NULL, NULL, 'CRIMPING STANDARD & IS', 'VISUAL', true, true, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 55, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1299, 5, '9', '9B. ADA STAMP CONTROL DAN STAMP "CONFIDENTIAL"', NULL, NULL, 'B', NULL, NULL, NULL, 'CRIMPING STANDARD & IS', 'VISUAL', true, true, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 56, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1300, 5, '10', '10A. TROLLY DALAM KONDISI BAIK DAN TIDAK RUSAK', NULL, NULL, 'A', NULL, NULL, NULL, 'TROLLY INSPECTOR', 'VISUAL', false, false, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 57, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1301, 5, '10', '10A. TROLLY DALAM KONDISI BAIK DAN TIDAK RUSAK', NULL, NULL, 'B', NULL, NULL, NULL, 'TROLLY INSPECTOR', 'VISUAL', false, false, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 58, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1302, 5, '10', '10B. TEMPAT CUP TIDAK RUSAK', NULL, NULL, 'A', NULL, NULL, NULL, 'TROLLY INSPECTOR', 'VISUAL', false, false, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 59, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1303, 5, '10', '10B. TEMPAT CUP TIDAK RUSAK', NULL, NULL, 'B', NULL, NULL, NULL, 'TROLLY INSPECTOR', 'VISUAL', false, false, true, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 60, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1304, 5, '11', '11A. ADA 2 LAMPU DI AREA INSPEKSI UV', NULL, NULL, 'A', NULL, NULL, NULL, 'LAMPU UV', 'VISUAL', false, false, false, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 61, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1305, 5, '11', '11A. ADA 2 LAMPU DI AREA INSPEKSI UV', NULL, NULL, 'B', NULL, NULL, NULL, 'LAMPU UV', 'VISUAL', false, false, false, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 62, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1306, 5, '11', '11B. SAAT DIOPERASIKAN LAMPU MENYALA TERANG (TIDAK ADA LAMPU LED YANG MATI ò 3 PCS DALAM LENSA UV)', NULL, NULL, 'A', NULL, NULL, NULL, 'LAMPU UV', 'VISUAL', false, false, false, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 63, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1307, 5, '11', '11B. SAAT DIOPERASIKAN LAMPU MENYALA TERANG (TIDAK ADA LAMPU LED YANG MATI ò 3 PCS DALAM LENSA UV)', NULL, NULL, 'B', NULL, NULL, NULL, 'LAMPU UV', 'VISUAL', false, false, false, true, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 64, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1308, 5, '12', '12A. TOMBOL ON OFF BERFUNGSI, TIDAK RUSAK DAN LAMPU INDIKATOR MENYALA', NULL, NULL, 'A', NULL, NULL, NULL, 'MESIN SIMPLE CROSS SECTION', 'VISUAL', false, true, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 65, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1309, 5, '12', '12A. TOMBOL ON OFF BERFUNGSI, TIDAK RUSAK DAN LAMPU INDIKATOR MENYALA', NULL, NULL, 'B', NULL, NULL, NULL, 'MESIN SIMPLE CROSS SECTION', 'VISUAL', false, true, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 66, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1310, 5, '12', '12B. TIDAK BERBAU ASAP DAN STOP KONTAK TERPASANG SEMPURNA', NULL, NULL, 'A', NULL, NULL, NULL, 'MESIN SIMPLE CROSS SECTION', 'VISUAL', false, true, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 67, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1311, 5, '12', '12B. TIDAK BERBAU ASAP DAN STOP KONTAK TERPASANG SEMPURNA', NULL, NULL, 'B', NULL, NULL, NULL, 'MESIN SIMPLE CROSS SECTION', 'VISUAL', false, true, false, false, 'Setiap Hari', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, false, false, true, 68, '2026-02-11 08:52:47.80649', '2026-02-11 08:52:47.80649', NULL);
INSERT INTO public.checklist_items VALUES (1312, 7, '1', 'Apakah pressure jig diletakkan sesuai dengan tempatnya.', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, '1x /Hari', 'O/X', NULL, NULL, false, false, false, false, false, true, 1, '2026-02-11 08:58:29.610301', '2026-02-11 08:58:29.610301', NULL);
INSERT INTO public.checklist_items VALUES (1313, 7, '1', 'Apakah pressure jig diletakkan sesuai dengan tempatnya.', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, '1x /Hari', 'O/X', NULL, NULL, false, false, false, false, false, true, 2, '2026-02-11 08:58:29.610301', '2026-02-11 08:58:29.610301', NULL);
INSERT INTO public.checklist_items VALUES (1314, 7, '2', 'Tidak ada pressure jig yang hilang.', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, '1x /Hari', 'O/X', NULL, NULL, false, false, false, false, false, true, 3, '2026-02-11 08:58:29.610301', '2026-02-11 08:58:29.610301', NULL);
INSERT INTO public.checklist_items VALUES (1315, 7, '2', 'Tidak ada pressure jig yang hilang.', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, '1x /Hari', 'O/X', NULL, NULL, false, false, false, false, false, true, 4, '2026-02-11 08:58:29.610301', '2026-02-11 08:58:29.610301', NULL);
INSERT INTO public.checklist_items VALUES (1316, 7, '3', 'Tidak ada pressure jig yang rusak/bent/damage.', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, '1x /Hari', 'O/X', NULL, NULL, false, false, false, false, false, true, 5, '2026-02-11 08:58:29.610301', '2026-02-11 08:58:29.610301', NULL);
INSERT INTO public.checklist_items VALUES (1317, 7, '3', 'Tidak ada pressure jig yang rusak/bent/damage.', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, '1x /Hari', 'O/X', NULL, NULL, false, false, false, false, false, true, 6, '2026-02-11 08:58:29.610301', '2026-02-11 08:58:29.610301', NULL);
INSERT INTO public.checklist_items VALUES (1318, 7, '4', 'Apakah pin dari contact pressure jig bisa digunakan dengan mudah.', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, '1x /Hari', 'O/X', NULL, NULL, false, false, false, false, false, true, 7, '2026-02-11 08:58:29.610301', '2026-02-11 08:58:29.610301', NULL);
INSERT INTO public.checklist_items VALUES (1319, 7, '4', 'Apakah pin dari contact pressure jig bisa digunakan dengan mudah.', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, '1x /Hari', 'O/X', NULL, NULL, false, false, false, false, false, true, 8, '2026-02-11 08:58:29.610301', '2026-02-11 08:58:29.610301', NULL);
INSERT INTO public.checklist_items VALUES (1320, 7, '5', 'Tidak ada identitas warna tape pada pressure jig yang terkelupas.', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, '1x /Hari', 'O/X', NULL, NULL, false, false, false, false, false, true, 9, '2026-02-11 08:58:29.610301', '2026-02-11 08:58:29.610301', NULL);
INSERT INTO public.checklist_items VALUES (1321, 7, '5', 'Tidak ada identitas warna tape pada pressure jig yang terkelupas.', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, '1x /Hari', 'O/X', NULL, NULL, false, false, false, false, false, true, 10, '2026-02-11 08:58:29.610301', '2026-02-11 08:58:29.610301', NULL);
INSERT INTO public.checklist_items VALUES (1322, 7, '6', 'Tidak ada jig yang tidak diperlukan di area proses.', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, '1x /Hari', 'O/X', NULL, NULL, false, false, false, false, false, true, 11, '2026-02-11 08:58:29.610301', '2026-02-11 08:58:29.610301', NULL);
INSERT INTO public.checklist_items VALUES (1323, 7, '6', 'Tidak ada jig yang tidak diperlukan di area proses.', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, '1x /Hari', 'O/X', NULL, NULL, false, false, false, false, false, true, 12, '2026-02-11 08:58:29.610301', '2026-02-11 08:58:29.610301', NULL);
INSERT INTO public.checklist_items VALUES (1324, 7, '7', 'Apakah tekanan dari contact pressure jig masih dalam skala rata-rata.', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, '1x /Bulan', ' ', NULL, NULL, false, false, false, false, false, true, 13, '2026-02-11 08:58:29.610301', '2026-02-11 08:58:29.610301', NULL);
INSERT INTO public.checklist_items VALUES (1325, 7, '7', 'Apakah tekanan dari contact pressure jig masih dalam skala rata-rata.', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, '1x /Bulan', ' ', NULL, NULL, false, false, false, false, false, true, 14, '2026-02-11 08:58:29.610301', '2026-02-11 08:58:29.610301', NULL);
INSERT INTO public.checklist_items VALUES (1, 1, '1', 'Check 4M kondisi, product yang mengalami perubahan 4M sudah di check dan tidak ada masalah', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Absensi Inspector', NULL, false, false, false, false, false, true, 1, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (2, 1, '1', 'Check 4M kondisi, product yang mengalami perubahan 4M sudah di check dan tidak ada masalah', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Absensi Inspector', NULL, false, false, false, false, false, true, 2, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (10, 1, '4', 'Kondisi tool dan gauge di area inspection tidak ada yang rusak atau hilang dan ada identitasnya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual Tool / Gauge', NULL, false, false, false, false, false, true, 10, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (4, 1, '2', 'Dilakukan pengecheckan HLC checker fixture dengan alignment gauge oleh inspector checker di akhir shift / checker fixture tidak terpakai', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Sheet HLC Checker', NULL, false, false, false, false, false, true, 4, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (20, 1, '9', 'Pengisian LKI dan DP oleh inspector sudah dilakukan dengan benar', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual LKI', NULL, false, false, false, false, false, true, 20, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (28, 1, '13', 'Inspection point / Important point yang dipasang tidak ada yang rusak dan up to date, check area Sub Assy sampai Receiving Inspection', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check important Point', NULL, false, false, false, false, false, true, 28, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (36, 1, '17', 'Cek Magic Pile yang digunakan di area inspeksi & produksi dalam kondisi baik (tidak sobek, tidak berserabut & resleting dalam kondisi baik)', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual', NULL, false, false, false, false, false, true, 36, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (38, 1, '18', 'Dummy Sample OK & N-OK Air Checker di area Sigage ada no registrasi, verifikasi tidak expired serta dalam kondisi baik dan tidak rusak', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 'Check Actual', NULL, false, false, false, false, false, true, 38, '2026-02-10 14:15:54.267759', '2026-02-10 14:15:54.267759', NULL);
INSERT INTO public.checklist_items VALUES (1102, 6, '1', '1-150A - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-150A', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 1, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1103, 6, '1', '1-150A - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-150A', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 2, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1104, 6, '1', '1-150A - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-150A', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 3, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1105, 6, '1', '1-150A - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-150A', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 4, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1106, 6, '1', '1-150A - Terpasang Cover', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-150A', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 5, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1107, 6, '1', '1-150A - Terpasang Cover', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-150A', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 6, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1108, 6, '1', '1-150A - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-150A', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 7, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1109, 6, '1', '1-150A - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-150A', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 8, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1110, 6, '2', 'PA - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'PA', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 9, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1111, 6, '2', 'PA - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'PA', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 10, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1112, 6, '2', 'PA - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'PA', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 11, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1113, 6, '2', 'PA - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'PA', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 12, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1114, 6, '2', 'PA - Terpasang Cover', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'PA', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 13, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1115, 6, '2', 'PA - Terpasang Cover', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'PA', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 14, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1116, 6, '2', 'PA - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'PA', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 15, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1117, 6, '2', 'PA - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'PA', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 16, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1118, 6, '3', 'DLI - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'DLI', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 17, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1119, 6, '3', 'DLI - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'DLI', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 18, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1120, 6, '3', 'DLI - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'DLI', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 19, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1121, 6, '3', 'DLI - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'DLI', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 20, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1122, 6, '3', 'DLI - Terpasang Cover', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'DLI', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 21, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1123, 6, '3', 'DLI - Terpasang Cover', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'DLI', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 22, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1124, 6, '3', 'DLI - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'DLI', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 23, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1125, 6, '3', 'DLI - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'DLI', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 24, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1126, 6, '4', 'CNR - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'CNR', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 25, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1127, 6, '4', 'CNR - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'CNR', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 26, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1128, 6, '4', 'CNR - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'CNR', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 27, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1129, 6, '4', 'CNR - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'CNR', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 28, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1130, 6, '4', 'CNR - Terpasang Cover', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'CNR', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 29, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1131, 6, '4', 'CNR - Terpasang Cover', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'CNR', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 30, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1132, 6, '4', 'CNR - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'CNR', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 31, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1133, 6, '4', 'CNR - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'CNR', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 32, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1134, 6, '5', 'TCNR - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'TCNR', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 33, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1135, 6, '5', 'TCNR - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'TCNR', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 34, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1136, 6, '5', 'TCNR - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'TCNR', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 35, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1137, 6, '5', 'TCNR - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'TCNR', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 36, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1138, 6, '5', 'TCNR - Terpasang Cover', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'TCNR', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 37, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1139, 6, '5', 'TCNR - Terpasang Cover', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'TCNR', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 38, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1140, 6, '5', 'TCNR - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'TCNR', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 39, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1141, 6, '5', 'TCNR - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'TCNR', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 40, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1142, 6, '6', '1-72A - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-72A', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 41, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1143, 6, '6', '1-72A - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-72A', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 42, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1144, 6, '6', '1-72A - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-72A', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 43, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1145, 6, '6', '1-72A - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-72A', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 44, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1146, 6, '6', '1-72A - Terpasang Cover', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-72A', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 45, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1147, 6, '6', '1-72A - Terpasang Cover', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-72A', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 46, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1148, 6, '6', '1-72A - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-72A', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 47, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1149, 6, '6', '1-72A - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-72A', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 48, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1150, 6, '7', '1-114 - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-114', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 49, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1151, 6, '7', '1-114 - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-114', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 50, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1152, 6, '7', '1-114 - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-114', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 51, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1153, 6, '7', '1-114 - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-114', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 52, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1154, 6, '7', '1-114 - Terpasang Cover', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-114', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 53, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1155, 6, '7', '1-114 - Terpasang Cover', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-114', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 54, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1156, 6, '7', '1-114 - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-114', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 55, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1157, 6, '7', '1-114 - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-114', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 56, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1158, 6, '8', '1-42A - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-42A', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 57, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1159, 6, '8', '1-42A - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-42A', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 58, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1160, 6, '8', '1-42A - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-42A', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 59, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1161, 6, '8', '1-42A - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-42A', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 60, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1162, 6, '8', '1-42A - Terpasang Cover', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-42A', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 61, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1163, 6, '8', '1-42A - Terpasang Cover', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-42A', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 62, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1164, 6, '8', '1-42A - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-42A', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 63, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1165, 6, '8', '1-42A - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-42A', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 64, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1166, 6, '9', '1-35 - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-35', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 65, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1167, 6, '9', '1-35 - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-35', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 66, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1168, 6, '9', '1-35 - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-35', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 67, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1169, 6, '9', '1-35 - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-35', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 68, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1170, 6, '9', '1-35 - Terpasang Cover', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-35', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 69, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1171, 6, '9', '1-35 - Terpasang Cover', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-35', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 70, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1172, 6, '9', '1-35 - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-35', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 71, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1173, 6, '9', '1-35 - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-35', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 72, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1174, 6, '10', '1-85 - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-85', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 73, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1175, 6, '10', '1-85 - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-85', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 74, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1176, 6, '10', '1-85 - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-85', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 75, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1177, 6, '10', '1-85 - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-85', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 76, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1178, 6, '10', '1-85 - Terpasang Cover', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-85', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 77, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1179, 6, '10', '1-85 - Terpasang Cover', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-85', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 78, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1180, 6, '10', '1-85 - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-85', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 79, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1181, 6, '10', '1-85 - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-85', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 80, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1182, 6, '11', '1-83A - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-83A', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 81, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1183, 6, '11', '1-83A - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-83A', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 82, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1184, 6, '11', '1-83A - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-83A', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 83, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1185, 6, '11', '1-83A - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-83A', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 84, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1186, 6, '11', '1-83A - Terpasang Cover', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-83A', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 85, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1187, 6, '11', '1-83A - Terpasang Cover', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-83A', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 86, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1188, 6, '11', '1-83A - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-83A', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 87, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1189, 6, '11', '1-83A - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-83A', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 88, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1190, 6, '12', '1-73 - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-73', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 89, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1191, 6, '12', '1-73 - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-73', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 90, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1192, 6, '12', '1-73 - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-73', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 91, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1193, 6, '12', '1-73 - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-73', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 92, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1194, 6, '12', '1-73 - Terpasang Cover', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-73', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 93, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1195, 6, '12', '1-73 - Terpasang Cover', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-73', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 94, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1196, 6, '12', '1-73 - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-73', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 95, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1197, 6, '12', '1-73 - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-73', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 96, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1198, 6, '13', '1-105 - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-105', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 97, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1199, 6, '13', '1-105 - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-105', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 98, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1200, 6, '13', '1-105 - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-105', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 99, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1201, 6, '13', '1-105 - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-105', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 100, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1202, 6, '13', '1-105 - Terpasang Cover', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-105', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 101, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1203, 6, '13', '1-105 - Terpasang Cover', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-105', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 102, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1204, 6, '13', '1-105 - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-105', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 103, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1205, 6, '13', '1-105 - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, '1-105', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 104, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1206, 6, '14', 'TLC - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'TLC', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 105, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1207, 6, '14', 'TLC - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'TLC', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 106, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1208, 6, '14', 'TLC - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'TLC', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 107, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1209, 6, '14', 'TLC - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'TLC', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 108, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1210, 6, '14', 'TLC - Terpasang Cover', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'TLC', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 109, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1211, 6, '14', 'TLC - Terpasang Cover', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'TLC', '', 'Terpasang Cover', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 110, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1212, 6, '14', 'TLC - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'TLC', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 111, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1213, 6, '14', 'TLC - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'TLC', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 112, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1214, 6, '15', 'EXTRACTION JIG R - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG R', 'R', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 113, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1215, 6, '15', 'EXTRACTION JIG R - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG R', 'R', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 114, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1216, 6, '15', 'EXTRACTION JIG R - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG R', 'R', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 115, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1217, 6, '15', 'EXTRACTION JIG R - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG R', 'R', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 116, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1218, 6, '15', 'EXTRACTION JIG R - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG R', 'R', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 117, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1219, 6, '15', 'EXTRACTION JIG R - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG R', 'R', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 118, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1220, 6, '15', 'EXTRACTION JIG G - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG G', 'G', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 119, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1221, 6, '15', 'EXTRACTION JIG G - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG G', 'G', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 120, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1222, 6, '15', 'EXTRACTION JIG G - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG G', 'G', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 121, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1223, 6, '15', 'EXTRACTION JIG G - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG G', 'G', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 122, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1224, 6, '15', 'EXTRACTION JIG G - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG G', 'G', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 123, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1225, 6, '15', 'EXTRACTION JIG G - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG G', 'G', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 124, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1226, 6, '15', 'EXTRACTION JIG W - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG W', 'W', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 125, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1227, 6, '15', 'EXTRACTION JIG W - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG W', 'W', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 126, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1228, 6, '15', 'EXTRACTION JIG W - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG W', 'W', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 127, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1229, 6, '15', 'EXTRACTION JIG W - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG W', 'W', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 128, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1230, 6, '15', 'EXTRACTION JIG W - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG W', 'W', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 129, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1231, 6, '15', 'EXTRACTION JIG W - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG W', 'W', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 130, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1232, 6, '15', 'EXTRACTION JIG Y - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG Y', 'Y', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 131, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1233, 6, '15', 'EXTRACTION JIG Y - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG Y', 'Y', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 132, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1234, 6, '15', 'EXTRACTION JIG Y - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG Y', 'Y', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 133, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1235, 6, '15', 'EXTRACTION JIG Y - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG Y', 'Y', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 134, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1236, 6, '15', 'EXTRACTION JIG Y - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG Y', 'Y', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 135, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1237, 6, '15', 'EXTRACTION JIG Y - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'EXTRACTION JIG Y', 'Y', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 136, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1238, 6, '16', 'CLIPPER - Tidak patah / bengkok', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'CLIPPER', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 137, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1239, 6, '16', 'CLIPPER - Tidak patah / bengkok', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'CLIPPER', '', 'Tidak patah / bengkok', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 138, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1240, 6, '16', 'CLIPPER - Tidak berkarat', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'CLIPPER', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 139, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1241, 6, '16', 'CLIPPER - Tidak berkarat', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'CLIPPER', '', 'Tidak berkarat', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 140, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1242, 6, '16', 'CLIPPER - Ada dan sesuai control numbernya', NULL, NULL, 'A', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'CLIPPER', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 141, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);
INSERT INTO public.checklist_items VALUES (1243, 6, '16', 'CLIPPER - Ada dan sesuai control numbernya', NULL, NULL, 'B', NULL, NULL, NULL, NULL, NULL, false, false, false, false, NULL, 'CLIPPER', '', 'Ada dan sesuai control numbernya', NULL, NULL, NULL, NULL, false, false, false, false, false, true, 142, '2026-03-10 15:41:03.911926', '2026-03-10 15:41:03.911926', NULL);


--
-- Data for Name: checklist_results; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.checklist_results VALUES (657, 'user_1770797408736_j9ymegj', '12', 5, 2, '2026-04-11', 'A', 'GAUGE-PA-MCR-001', 'NG', '{"choices":["TIDAK ADA NOMOR REGISTER / KALIBRASI SUDAH EXPIRED","ANGKA TIDAK TERBACA (LAYAR MUNCUL HURUF \"B\", \"H\", \"INS\" ATAU \"P\")"],"other":""}', 'QA', '2026-04-11 17:26:29.36035', '2026-04-11 17:26:29.36035', '2026-04-11 23:29:29.063561', 38, NULL, NULL, '["data:image/jpeg;base64,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"]', 'TENSILE', NULL);
INSERT INTO public.checklist_results VALUES (658, 'user_1770797408736_j9ymegj', '12', 5, 7, '2026-04-11', 'A', 'GAUGE-PA-THG-001', 'OK', NULL, NULL, '2026-04-11 17:28:09.279016', '2026-04-11 17:28:09.279016', '2026-04-11 23:29:29.063561', 38, NULL, NULL, NULL, 'CUTTING', NULL);
INSERT INTO public.checklist_results VALUES (659, 'user_1770797408736_j9ymegj', '12', 5, 4, '2026-04-12', 'A', 'GAUGE-PA-TNS-001', 'OK', NULL, NULL, '2026-04-12 11:29:59.248318', '2026-04-12 11:29:59.248318', '2026-04-12 11:29:59.248318', 38, 'CONV-9', NULL, NULL, 'TENSILE', 'CONV-9');


--
-- Data for Name: checklist_results_backup; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.checklist_results_backup VALUES (114, 'user_1770696171875_bwjljww', '12345678', 1, 1, '2026-02-23', 'A', NULL, 'OK', NULL, NULL, '2026-02-23 08:46:03.531783', '2026-02-23 08:46:03.531783', '2026-02-23 09:11:26.637166', 1);
INSERT INTO public.checklist_results_backup VALUES (115, 'user_1770696171875_bwjljww', '12345678', 1, 1, '2026-02-23', 'B', NULL, 'NG', ' testing aja', 'QA', '2026-02-23 08:46:09.301169', '2026-02-23 08:46:09.301169', '2026-02-23 09:11:31.818625', 1);
INSERT INTO public.checklist_results_backup VALUES (124, 'user_1770797408736_j9ymegj', '12', 2, 1001, '2026-02-23', 'B', NULL, 'NG', ' testing ins FA', 'QA', '2026-02-23 09:14:40.334887', '2026-02-23 09:14:40.334887', '2026-02-23 09:14:40.334887', 6);
INSERT INTO public.checklist_results_backup VALUES (125, 'user_1770797408736_j9ymegj', '12', 2, 1002, '2026-02-23', 'A', NULL, 'OK', NULL, NULL, '2026-02-23 09:14:48.484643', '2026-02-23 09:14:48.484643', '2026-02-23 09:14:48.484643', 6);
INSERT INTO public.checklist_results_backup VALUES (120, 'user_1770797408736_j9ymegj', '12', 2, 1001, '2026-02-23', 'A', NULL, 'NG', ' oooh', 'QA', '2026-02-23 09:13:40.105516', '2026-02-23 09:13:40.105516', '2026-02-23 09:15:05.820813', 5);
INSERT INTO public.checklist_results_backup VALUES (134, 'user_1770797408736_j9ymegj', '12', 5, 1, '2026-02-23', 'A', '1', 'OK', '   ', '   ', '2026-02-23 09:40:35.02162', '2026-02-23 09:40:35.02162', '2026-02-23 09:40:35.02162', 16);
INSERT INTO public.checklist_results_backup VALUES (135, 'user_1770797408736_j9ymegj', '12', 5, 1, '2026-02-23', 'B', '1.1', 'NG', 'NG : Daily Check Ins. Row = 2', 'QA', '2026-02-23 09:47:20.204427', '2026-02-23 09:47:20.204427', '2026-02-23 09:47:38.18624', 16);
INSERT INTO public.checklist_results_backup VALUES (137, 'user_1770797408736_j9ymegj', '12', 5, 2, '2026-02-23', 'B', '2.1', 'OK', '   ', '   ', '2026-02-23 09:59:08.788388', '2026-02-23 09:59:08.788388', '2026-02-23 09:59:08.788388', 17);
INSERT INTO public.checklist_results_backup VALUES (141, 'user_1770797408736_j9ymegj', '12', 6, 1104, '2026-02-23', 'A', NULL, 'OK', NULL, NULL, '2026-02-23 11:15:07.370202', '2026-02-23 11:15:07.370202', '2026-02-23 11:15:07.370202', 21);
INSERT INTO public.checklist_results_backup VALUES (139, 'user_1770797408736_j9ymegj', '12', 6, 1103, '2026-02-23', 'B', NULL, 'OK', NULL, NULL, '2026-02-23 10:53:20.892351', '2026-02-23 10:53:20.892351', '2026-02-23 11:15:10.555362', 21);
INSERT INTO public.checklist_results_backup VALUES (144, 'user_1770797408736_j9ymegj', '12', 6, 1105, '2026-02-23', 'B', NULL, 'OK', NULL, NULL, '2026-02-23 11:15:34.624241', '2026-02-23 11:15:34.624241', '2026-02-23 11:15:41.529012', 21);
INSERT INTO public.checklist_results_backup VALUES (149, 'user_1770797408736_j9ymegj', '12', 5, 1, '2026-02-23', 'A', NULL, 'OK', '   ', '   ', '2026-02-23 11:49:06.486049', '2026-02-23 11:49:06.486049', '2026-02-23 11:49:06.486049', 17);
INSERT INTO public.checklist_results_backup VALUES (150, 'user_1770797408736_j9ymegj', '12', 5, 1, '2026-02-23', 'B', NULL, 'OK', '   ', '   ', '2026-02-23 11:49:10.78928', '2026-02-23 11:49:10.78928', '2026-02-23 11:49:15.154507', 17);
INSERT INTO public.checklist_results_backup VALUES (152, 'user_1770797408736_j9ymegj', '12', 5, 2, '2026-02-23', 'A', NULL, 'NG', 'Test', 'QA', '2026-02-23 11:49:20.135502', '2026-02-23 11:49:20.135502', '2026-02-23 11:49:24.631631', 17);
INSERT INTO public.checklist_results_backup VALUES (138, 'user_1770797408736_j9ymegj', '12', 6, 1102, '2026-02-23', 'A', NULL, 'OK', NULL, NULL, '2026-02-23 10:53:19.649483', '2026-02-23 10:53:19.649483', '2026-02-23 11:55:16.275945', 21);


--
-- Data for Name: checklist_signatures; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.checklist_signatures VALUES (10, 'user_1770696171875_bwjljww', '12345678', 1, '2026-02-23', 'A', 'OK', '2026-02-24 01:07:34.367233', '2026-02-24 01:07:34.367233', '2026-02-24 01:07:34.367233', 1, NULL, NULL);
INSERT INTO public.checklist_signatures VALUES (13, 'user_1770696171875_bwjljww', '12345678', 2, '2026-02-23', 'A', 'OK', '2026-02-24 01:08:32.284436', '2026-02-24 01:08:32.284436', '2026-02-24 01:08:32.284436', 5, NULL, NULL);
INSERT INTO public.checklist_signatures VALUES (15, 'user_1770696171875_bwjljww', '12345678', 2, '2026-02-23', 'B', 'OK', '2026-02-24 01:08:47.889291', '2026-02-24 01:08:47.889291', '2026-02-24 01:08:47.889291', 5, NULL, NULL);


--
-- Data for Name: gauge_checkpoint_results; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.gauge_checkpoint_results VALUES ('fd7f99e0-0f92-4c52-b043-521c131671f7', '31b4d18e-4655-4d32-8b01-d8ab449bb5eb', '3d006eba-2034-477f-9314-2cd4dbea89ee', 'user_1770696171875_bwjljww', '2026-02-24', 'A', 'OK', NULL, '2026-02-24 15:29:15.606029', '12345678');
INSERT INTO public.gauge_checkpoint_results VALUES ('55488d31-8d66-4207-8861-a090df1cd4b4', '31b4d18e-4655-4d32-8b01-d8ab449bb5eb', '1d295924-4d6b-452e-b76d-c48b86e37b7e', 'user_1770696171875_bwjljww', '2026-02-24', 'A', 'OK', NULL, '2026-02-24 15:29:15.606029', '12345678');
INSERT INTO public.gauge_checkpoint_results VALUES ('3d7ae9ca-af00-43a2-a079-4e0ac37aeb13', '31b4d18e-4655-4d32-8b01-d8ab449bb5eb', 'afedfb3a-db22-495c-9f00-d74efaa92b97', 'user_1770696171875_bwjljww', '2026-02-24', 'A', 'OK', NULL, '2026-02-24 15:29:15.606029', '12345678');


--
-- Data for Name: gauge_checkpoints; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.gauge_checkpoints VALUES ('3d006eba-2034-477f-9314-2cd4dbea89ee', 'PUSH-GAUGE', 'Karet', 1, true, true, '2026-02-24 07:25:54.739748', '2026-02-24 07:25:54.739748');
INSERT INTO public.gauge_checkpoints VALUES ('1d295924-4d6b-452e-b76d-c48b86e37b7e', 'PUSH-GAUGE', 'LED Indicator', 2, true, true, '2026-02-24 07:25:54.739748', '2026-02-24 07:25:54.739748');
INSERT INTO public.gauge_checkpoints VALUES ('afedfb3a-db22-495c-9f00-d74efaa92b97', 'PUSH-GAUGE', 'Spring Mechanism', 3, true, true, '2026-02-24 07:25:54.739748', '2026-02-24 07:25:54.739748');
INSERT INTO public.gauge_checkpoints VALUES ('34d07f96-99e0-45f6-ace7-b7598a2ff1c7', 'GO-NO-GO', 'Terminal Condition', 1, true, true, '2026-02-24 07:26:03.992121', '2026-02-24 07:26:03.992121');
INSERT INTO public.gauge_checkpoints VALUES ('b92f1745-7953-40f3-8077-cd8225e15894', 'GO-NO-GO', 'Wire Protection', 2, true, true, '2026-02-24 07:26:03.992121', '2026-02-24 07:26:03.992121');
INSERT INTO public.gauge_checkpoints VALUES ('8f71b23f-97ae-4f19-9ea1-a30ffc5b7be2', 'GO-NO-GO', 'Calibration Sticker', 3, true, true, '2026-02-24 07:26:03.992121', '2026-02-24 07:26:03.992121');


--
-- Data for Name: gauge_inspections; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: gauge_qr_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.gauge_qr_codes VALUES (1, 2, 'micrometer', 'MICROMETER', 'pre-assy', 'GAUGE-PA-MCR-001', 'DCI-2-GAUGE-PA-MCR-001', 'Micrometer PA #1', 1, NULL, true, NULL, '2026-03-11 09:24:15.810758+07', '2026-03-11 09:24:15.810758+07');
INSERT INTO public.gauge_qr_codes VALUES (2, 2, 'micrometer', 'MICROMETER', 'pre-assy', 'GAUGE-PA-MCR-002', 'DCI-2-GAUGE-PA-MCR-002', 'Micrometer PA #2', 2, NULL, true, NULL, '2026-03-11 09:24:15.810758+07', '2026-03-11 09:24:15.810758+07');
INSERT INTO public.gauge_qr_codes VALUES (3, 3, 'caliper', 'CALIPER', 'pre-assy', 'GAUGE-PA-CAL-001', 'DCI-3-GAUGE-PA-CAL-001', 'Caliper PA #1', 1, NULL, true, NULL, '2026-03-11 09:24:15.810758+07', '2026-03-11 09:24:15.810758+07');
INSERT INTO public.gauge_qr_codes VALUES (4, 3, 'caliper', 'CALIPER', 'pre-assy', 'GAUGE-PA-CAL-002', 'DCI-3-GAUGE-PA-CAL-002', 'Caliper PA #2', 2, NULL, true, NULL, '2026-03-11 09:24:15.810758+07', '2026-03-11 09:24:15.810758+07');
INSERT INTO public.gauge_qr_codes VALUES (5, 4, 'tensile', 'MESIN TENSILE', 'pre-assy', 'GAUGE-PA-TNS-001', 'DCI-4-GAUGE-PA-TNS-001', 'Mesin Tensile PA #1', 1, NULL, true, NULL, '2026-03-11 09:24:15.810758+07', '2026-03-11 09:24:15.810758+07');
INSERT INTO public.gauge_qr_codes VALUES (6, 5, 'steel-ruler', 'STEEL RULER', 'pre-assy', 'GAUGE-PA-STR-001', 'DCI-5-GAUGE-PA-STR-001', 'Steel Ruler PA #1', 1, NULL, true, NULL, '2026-03-11 09:24:15.810758+07', '2026-03-11 09:24:15.810758+07');
INSERT INTO public.gauge_qr_codes VALUES (7, 5, 'steel-ruler', 'STEEL RULER', 'pre-assy', 'GAUGE-PA-STR-002', 'DCI-5-GAUGE-PA-STR-002', 'Steel Ruler PA #2', 2, NULL, true, NULL, '2026-03-11 09:24:15.810758+07', '2026-03-11 09:24:15.810758+07');
INSERT INTO public.gauge_qr_codes VALUES (8, 6, 'bent-gauge', 'BENT UP/DOWN GAUGE', 'pre-assy', 'GAUGE-PA-BNG-001', 'DCI-6-GAUGE-PA-BNG-001', 'Bent Up/Down Gauge PA #1', 1, NULL, true, NULL, '2026-03-11 09:24:15.810758+07', '2026-03-11 09:24:15.810758+07');
INSERT INTO public.gauge_qr_codes VALUES (9, 7, 'thickness-gauge', 'THICKNESS GAUGE / GO NO GO', 'pre-assy', 'GAUGE-PA-THG-001', 'DCI-7-GAUGE-PA-THG-001', 'Thickness Gauge/Go No Go PA #1', 1, NULL, true, NULL, '2026-03-11 09:24:15.810758+07', '2026-03-11 09:24:15.810758+07');
INSERT INTO public.gauge_qr_codes VALUES (10, 7, 'thickness-gauge', 'THICKNESS GAUGE / GO NO GO', 'pre-assy', 'GAUGE-PA-THG-002', 'DCI-7-GAUGE-PA-THG-002', 'Thickness Gauge/Go No Go PA #2', 2, NULL, true, NULL, '2026-03-11 09:24:15.810758+07', '2026-03-11 09:24:15.810758+07');
INSERT INTO public.gauge_qr_codes VALUES (11, 8, 'pocket-comparator', 'POCKET COMPARATOR', 'pre-assy', 'GAUGE-PA-PKC-001', 'DCI-8-GAUGE-PA-PKC-001', 'Pocket Comparator PA #1', 1, NULL, true, NULL, '2026-03-11 09:24:15.810758+07', '2026-03-11 09:24:15.810758+07');
INSERT INTO public.gauge_qr_codes VALUES (12, 9, 'crimping-standard', 'CRIMPING STANDARD & IS', 'pre-assy', 'GAUGE-PA-CRS-001', 'DCI-9-GAUGE-PA-CRS-001', 'Crimping Standard & IS PA #1', 1, NULL, true, NULL, '2026-03-11 09:24:15.810758+07', '2026-03-11 09:24:15.810758+07');
INSERT INTO public.gauge_qr_codes VALUES (24, 2, 'micrometer', 'MICROMETER', 'pre-assy', 'GAUGE-PA-MCR-003', 'DCI-2-GAUGE-PA-MCR-003', 'MICROMETER PA #3', 3, NULL, true, 'user_admin_001', '2026-03-11 10:36:13.249658+07', '2026-03-11 10:36:13.249658+07');
INSERT INTO public.gauge_qr_codes VALUES (25, 1, 'pipo', 'PIPO', 'final-assy', 'GAUGE-FA-PPO-001', 'DCI-1-GAUGE-FA-PPO-001', 'PIPO FA #1', 1, NULL, true, NULL, '2026-03-13 07:38:39.156977+07', '2026-03-13 07:38:39.156977+07');
INSERT INTO public.gauge_qr_codes VALUES (26, 2, 'roll-meter', 'ROLL METER / MISTAR BAJA', 'final-assy', 'GAUGE-FA-RMT-001', 'DCI-2-GAUGE-FA-RMT-001', 'ROLL METER / MISTAR BAJA FA #1', 1, NULL, true, NULL, '2026-03-13 07:38:39.156977+07', '2026-03-13 07:38:39.156977+07');
INSERT INTO public.gauge_qr_codes VALUES (27, 3, 'go-no-go', 'GO NO GO', 'final-assy', 'GAUGE-FA-GNG-001', 'DCI-3-GAUGE-FA-GNG-001', 'GO NO GO FA #1', 1, NULL, true, NULL, '2026-03-13 07:38:39.156977+07', '2026-03-13 07:38:39.156977+07');
INSERT INTO public.gauge_qr_codes VALUES (28, 4, 'push-gauge-rb', 'PUSH GAUGE RB', 'final-assy', 'GAUGE-FA-PGR-001', 'DCI-4-GAUGE-FA-PGR-001', 'PUSH GAUGE RB FA #1', 1, NULL, true, NULL, '2026-03-13 07:38:39.156977+07', '2026-03-13 07:38:39.156977+07');
INSERT INTO public.gauge_qr_codes VALUES (29, 5, 'dummy-sample', 'DUMMY SAMPLE OK & N-OK', 'final-assy', 'GAUGE-FA-DMS-001', 'DCI-5-GAUGE-FA-DMS-001', 'DUMMY SAMPLE OK & N-OK FA #1', 1, NULL, true, NULL, '2026-03-13 07:38:39.156977+07', '2026-03-13 07:38:39.156977+07');
INSERT INTO public.gauge_qr_codes VALUES (30, 6, 'inspection-point', 'IMPORTANT / INSPECTION POINT', 'final-assy', 'GAUGE-FA-INP-001', 'DCI-6-GAUGE-FA-INP-001', 'IMPORTANT / INSPECTION POINT FA #1', 1, NULL, true, NULL, '2026-03-13 07:38:39.156977+07', '2026-03-13 07:38:39.156977+07');
INSERT INTO public.gauge_qr_codes VALUES (31, 7, 'fuse-plate', 'FUSE PLATE', 'final-assy', 'GAUGE-FA-FSP-001', 'DCI-7-GAUGE-FA-FSP-001', 'FUSE PLATE FA #1', 1, NULL, true, NULL, '2026-03-13 07:38:39.156977+07', '2026-03-13 07:38:39.156977+07');
INSERT INTO public.gauge_qr_codes VALUES (32, 8, 'lampu-navigasi', 'LAMPU NAVIGASI', 'final-assy', 'GAUGE-FA-LMN-001', 'DCI-8-GAUGE-FA-LMN-001', 'LAMPU NAVIGASI FA #1', 1, NULL, true, NULL, '2026-03-13 07:38:39.156977+07', '2026-03-13 07:38:39.156977+07');
INSERT INTO public.gauge_qr_codes VALUES (33, 9, 'tape-navigasi', 'TAPE NAVIGASI', 'final-assy', 'GAUGE-FA-TPN-001', 'DCI-9-GAUGE-FA-TPN-001', 'TAPE NAVIGASI FA #1', 1, NULL, true, NULL, '2026-03-13 07:38:39.156977+07', '2026-03-13 07:38:39.156977+07');
INSERT INTO public.gauge_qr_codes VALUES (34, 10, 'inspection-board', 'INSPECTION BOARD', 'final-assy', 'GAUGE-FA-ISB-001', 'DCI-10-GAUGE-FA-ISB-001', 'INSPECTION BOARD FA #1', 1, NULL, true, NULL, '2026-03-13 07:38:39.156977+07', '2026-03-13 07:38:39.156977+07');
INSERT INTO public.gauge_qr_codes VALUES (35, 11, 'dry-surf', 'DRY SURF', 'final-assy', 'GAUGE-FA-DRS-001', 'DCI-11-GAUGE-FA-DRS-001', 'DRY SURF FA #1', 1, NULL, true, NULL, '2026-03-13 07:38:39.156977+07', '2026-03-13 07:38:39.156977+07');
INSERT INTO public.gauge_qr_codes VALUES (36, 12, 'packing', 'PACKING', 'final-assy', 'GAUGE-FA-PKG-001', 'DCI-12-GAUGE-FA-PKG-001', 'PACKING FA #1', 1, NULL, true, NULL, '2026-03-13 07:38:39.156977+07', '2026-03-13 07:38:39.156977+07');
INSERT INTO public.gauge_qr_codes VALUES (37, 1, 'pipo', 'PIPO', 'final-assy', 'GAUGE-FA-PPO-002', 'DCI-1-GAUGE-FA-PPO-002', 'PIPO FA #2', 2, NULL, true, 'user_admin_001', '2026-03-17 09:55:43.84582+07', '2026-03-17 09:55:43.84582+07');
INSERT INTO public.gauge_qr_codes VALUES (38, 1, 'pipo', 'PIPO', 'final-assy', 'GAUGE-FA-PPO-003', 'DCI-1-GAUGE-FA-PPO-003', 'PIPO FA #3', 3, NULL, true, 'user_admin_001', '2026-03-17 10:20:36.736662+07', '2026-03-17 10:20:36.736662+07');
INSERT INTO public.gauge_qr_codes VALUES (39, 1, 'pipo', 'PIPO', 'final-assy', 'GAUGE-FA-PPO-004', 'DCI-1-GAUGE-FA-PPO-004', 'PIPO FA #4', 4, NULL, true, 'user_admin_001', '2026-03-17 10:20:40.139542+07', '2026-03-17 10:20:40.139542+07');
INSERT INTO public.gauge_qr_codes VALUES (40, 3, 'go-no-go', 'GO NO GO', 'final-assy', 'GAUGE-FA-GNG-002', 'DCI-3-GAUGE-FA-GNG-002', 'GO NO GO FA #2', 2, NULL, true, 'user_admin_001', '2026-03-17 10:21:42.675405+07', '2026-03-17 10:21:42.675405+07');
INSERT INTO public.gauge_qr_codes VALUES (41, 6, 'bent-gauge', 'BENT UP/DOWN GAUGE', 'pre-assy', 'GAUGE-PA-BNG-002', 'DCI-6-GAUGE-PA-BNG-002', 'BENT UP/DOWN GAUGE PA #2', 2, NULL, true, 'user_admin_001', '2026-04-07 18:44:17.70126+07', '2026-04-07 18:44:17.70126+07');
INSERT INTO public.gauge_qr_codes VALUES (43, 10, 'dial-gauge', 'DIAL GAUGE', 'pre-assy', 'GAUGE-PA-DIA-001', 'DCI-10-GAUGE-PA-DIA-001', 'DIAL GAUGE PA #1', 1, NULL, true, 'user_admin_001', '2026-04-07 19:16:15.028847+07', '2026-04-07 19:16:15.028847+07');
INSERT INTO public.gauge_qr_codes VALUES (44, 9, 'tape-navigasi', 'TAPE NAVIGASI', 'final-assy', 'GAUGE-FA-TAPE-002', 'DCI-9-GAUGE-FA-TAPE-002', 'TAPE NAVIGASI FA #2', 2, NULL, true, 'user_admin_001', '2026-04-09 07:45:32.81979+07', '2026-04-09 07:45:32.81979+07');


--
-- Data for Name: gauge_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.gauge_types VALUES (1, 'roll-meter', 'ROLL METER / MISTAR BAJA', 'final-assy', 2, 'ROLL', true, NULL, '2026-03-13 07:38:39.156977+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (2, 'go-no-go', 'GO NO GO', 'final-assy', 3, 'GO-N', true, NULL, '2026-03-13 07:38:39.156977+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (3, 'steel-ruler', 'STEEL RULER', 'pre-assy', 5, 'STEE', true, NULL, '2026-03-11 09:24:15.810758+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (4, 'caliper', 'CALIPER', 'pre-assy', 3, 'CALI', true, NULL, '2026-03-11 09:24:15.810758+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (5, 'bent-gauge', 'BENT UP/DOWN GAUGE', 'pre-assy', 6, 'BENT', true, NULL, '2026-03-11 09:24:15.810758+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (6, 'crimping-standard', 'CRIMPING STANDARD & IS', 'pre-assy', 9, 'CRIM', true, NULL, '2026-03-11 09:24:15.810758+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (7, 'dummy-sample', 'DUMMY SAMPLE OK & N-OK', 'final-assy', 5, 'DUMM', true, NULL, '2026-03-13 07:38:39.156977+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (8, 'inspection-board', 'INSPECTION BOARD', 'final-assy', 10, 'INSP', true, NULL, '2026-03-13 07:38:39.156977+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (9, 'pipo', 'PIPO', 'final-assy', 1, 'PIPO', true, NULL, '2026-03-13 07:38:39.156977+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (10, 'fuse-plate', 'FUSE PLATE', 'final-assy', 7, 'FUSE', true, NULL, '2026-03-13 07:38:39.156977+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (11, 'pocket-comparator', 'POCKET COMPARATOR', 'pre-assy', 8, 'POCK', true, NULL, '2026-03-11 09:24:15.810758+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (12, 'tape-navigasi', 'TAPE NAVIGASI', 'final-assy', 9, 'TAPE', true, NULL, '2026-03-13 07:38:39.156977+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (13, 'micrometer', 'MICROMETER', 'pre-assy', 2, 'MICR', true, NULL, '2026-03-11 09:24:15.810758+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (14, 'tensile', 'MESIN TENSILE', 'pre-assy', 4, 'TENS', true, NULL, '2026-03-11 09:24:15.810758+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (15, 'lampu-navigasi', 'LAMPU NAVIGASI', 'final-assy', 8, 'LAMP', true, NULL, '2026-03-13 07:38:39.156977+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (16, 'dry-surf', 'DRY SURF', 'final-assy', 11, 'DRY-', true, NULL, '2026-03-13 07:38:39.156977+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (17, 'packing', 'PACKING', 'final-assy', 12, 'PACK', true, NULL, '2026-03-13 07:38:39.156977+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (18, 'thickness-gauge', 'THICKNESS GAUGE / GO NO GO', 'pre-assy', 7, 'THIC', true, NULL, '2026-03-11 09:24:15.810758+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (19, 'push-gauge-rb', 'PUSH GAUGE RB', 'final-assy', 4, 'PUSH', true, NULL, '2026-03-13 07:38:39.156977+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (20, 'inspection-point', 'IMPORTANT / INSPECTION POINT', 'final-assy', 6, 'INSP', true, NULL, '2026-03-13 07:38:39.156977+07', '2026-04-07 19:31:55.623262+07');
INSERT INTO public.gauge_types VALUES (21, 'dial-gauge', 'DIAL GAUGE', 'pre-assy', 10, 'DIAL', true, NULL, '2026-04-07 19:16:04.559529+07', '2026-04-07 19:31:55.623262+07');


--
-- Data for Name: gauges; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.gauges VALUES ('31b4d18e-4655-4d32-8b01-d8ab449bb5eb', 'PG001', 'PUSH-GAUGE', 'Push Gauge RB-1', NULL, 1, '2026-06-30', true, '2026-02-24 04:45:50.636635');
INSERT INTO public.gauges VALUES ('70392476-c2ae-4df6-9a6e-d93558516355', 'PG002', 'PUSH-GAUGE', 'Push Gauge RB-2', 1, 2, '2026-12-31', true, '2026-02-24 11:02:54.62436');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users VALUES ('user_1770696171875_bwjljww', 'gl_qa_daniar', 'Daniar Priambodo', '12345678', 'quality-assurance', 'group-leader-qa', '$2b$10$CCYyvroKt871iw9Cxxd1IezBqrA0PaD1D6LqhCPJ/3iUySGhc.Wv.', true, '2026-02-10 11:02:51.87784', '2026-02-10 11:02:51.87784', '2026-04-09 13:37:22.388812');
INSERT INTO public.users VALUES ('user_admin_001', 'admin', 'Administrator', '99999999', 'admin', 'admin', '$2b$10$kbH/vb1aXDRHqtjzQLPdruxRdj1eBI7VIdKJBKgZTSjj1U2TKsXxy', true, '2026-03-02 13:17:57.779774', '2026-03-02 13:17:57.779774', '2026-04-11 17:30:44.513538');
INSERT INTO public.users VALUES ('user_1770797408736_j9ymegj', 'ins_qa_daniar', 'Daniar Priambodo', '12', 'quality-assurance', 'inspector-qa', '$2b$10$ESEYBy3GztMwMIdFepZJ6u..wzbukAiyD.jD7l4FocwnPBeVQC/X2', true, '2026-02-11 15:10:08.738149', '2026-02-11 15:10:08.738149', '2026-04-13 07:37:34.098405');


--
-- Name: carline_line_mapping_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.carline_line_mapping_id_seq', 18, true);


--
-- Name: checklist_areas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.checklist_areas_id_seq', 52, true);


--
-- Name: checklist_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.checklist_categories_id_seq', 7, true);


--
-- Name: checklist_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.checklist_history_id_seq', 1, false);


--
-- Name: checklist_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.checklist_items_id_seq', 1325, true);


--
-- Name: checklist_results_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.checklist_results_id_seq', 659, true);


--
-- Name: checklist_signatures_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.checklist_signatures_id_seq', 15, true);


--
-- Name: gauge_qr_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.gauge_qr_codes_id_seq', 44, true);


--
-- Name: gauge_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.gauge_types_id_seq', 21, true);


--
-- Name: carline_line_mapping carline_line_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carline_line_mapping
    ADD CONSTRAINT carline_line_mapping_pkey PRIMARY KEY (id);


--
-- Name: carline_line_mapping carline_line_mapping_user_id_conveyor_category_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carline_line_mapping
    ADD CONSTRAINT carline_line_mapping_user_id_conveyor_category_code_key UNIQUE (user_id, conveyor, category_code);


--
-- Name: checklist_areas checklist_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_areas
    ADD CONSTRAINT checklist_areas_pkey PRIMARY KEY (id);


--
-- Name: checklist_categories checklist_categories_category_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_categories
    ADD CONSTRAINT checklist_categories_category_code_key UNIQUE (category_code);


--
-- Name: checklist_categories checklist_categories_category_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_categories
    ADD CONSTRAINT checklist_categories_category_name_key UNIQUE (category_name);


--
-- Name: checklist_categories checklist_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_categories
    ADD CONSTRAINT checklist_categories_pkey PRIMARY KEY (id);


--
-- Name: checklist_history checklist_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_history
    ADD CONSTRAINT checklist_history_pkey PRIMARY KEY (id);


--
-- Name: checklist_items checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_items
    ADD CONSTRAINT checklist_items_pkey PRIMARY KEY (id);


--
-- Name: checklist_results checklist_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_results
    ADD CONSTRAINT checklist_results_pkey PRIMARY KEY (id);


--
-- Name: checklist_signatures checklist_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_signatures
    ADD CONSTRAINT checklist_signatures_pkey PRIMARY KEY (id);


--
-- Name: gauge_checkpoint_results gauge_checkpoint_results_gauge_id_checkpoint_id_date_key_sh_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauge_checkpoint_results
    ADD CONSTRAINT gauge_checkpoint_results_gauge_id_checkpoint_id_date_key_sh_key UNIQUE (gauge_id, checkpoint_id, date_key, shift);


--
-- Name: gauge_checkpoint_results gauge_checkpoint_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauge_checkpoint_results
    ADD CONSTRAINT gauge_checkpoint_results_pkey PRIMARY KEY (id);


--
-- Name: gauge_checkpoints gauge_checkpoints_gauge_type_checkpoint_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauge_checkpoints
    ADD CONSTRAINT gauge_checkpoints_gauge_type_checkpoint_name_key UNIQUE (gauge_type, checkpoint_name);


--
-- Name: gauge_checkpoints gauge_checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauge_checkpoints
    ADD CONSTRAINT gauge_checkpoints_pkey PRIMARY KEY (id);


--
-- Name: gauge_inspections gauge_inspections_gauge_id_date_key_shift_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauge_inspections
    ADD CONSTRAINT gauge_inspections_gauge_id_date_key_shift_key UNIQUE (gauge_id, date_key, shift);


--
-- Name: gauge_inspections gauge_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauge_inspections
    ADD CONSTRAINT gauge_inspections_pkey PRIMARY KEY (id);


--
-- Name: gauge_qr_codes gauge_qr_codes_gauge_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauge_qr_codes
    ADD CONSTRAINT gauge_qr_codes_gauge_id_key UNIQUE (gauge_id);


--
-- Name: gauge_qr_codes gauge_qr_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauge_qr_codes
    ADD CONSTRAINT gauge_qr_codes_pkey PRIMARY KEY (id);


--
-- Name: gauge_qr_codes gauge_qr_codes_qr_value_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauge_qr_codes
    ADD CONSTRAINT gauge_qr_codes_qr_value_key UNIQUE (qr_value);


--
-- Name: gauge_types gauge_types_gauge_type_slug_area_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauge_types
    ADD CONSTRAINT gauge_types_gauge_type_slug_area_type_key UNIQUE (gauge_type_slug, area_type);


--
-- Name: gauge_types gauge_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauge_types
    ADD CONSTRAINT gauge_types_pkey PRIMARY KEY (id);


--
-- Name: gauges gauges_gauge_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauges
    ADD CONSTRAINT gauges_gauge_code_key UNIQUE (gauge_code);


--
-- Name: gauges gauges_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauges
    ADD CONSTRAINT gauges_pkey PRIMARY KEY (id);


--
-- Name: checklist_areas unique_category_area; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_areas
    ADD CONSTRAINT unique_category_area UNIQUE (category_id, area_code);


--
-- Name: users users_nik_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_nik_key UNIQUE (nik);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: checklist_results_unique_all; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX checklist_results_unique_all ON public.checklist_results USING btree (user_id, category_id, item_id, date_key, shift, COALESCE(time_slot, ''::character varying), COALESCE(area_id, '-1'::integer), COALESCE(carline, ''::character varying), COALESCE(line, ''::character varying), COALESCE(specific_area, ''::character varying));


--
-- Name: checklist_results_unique_all_v2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX checklist_results_unique_all_v2 ON public.checklist_results USING btree (user_id, category_id, item_id, date_key, shift, COALESCE(time_slot, ''::character varying), COALESCE(area_id, '-1'::integer), COALESCE(conveyor, ''::text), COALESCE(specific_area, ''::character varying));


--
-- Name: idx_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_active ON public.checklist_items USING btree (is_active);


--
-- Name: idx_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_area ON public.checklist_categories USING btree (area_type);


--
-- Name: idx_areas_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_areas_category ON public.checklist_areas USING btree (category_id);


--
-- Name: idx_areas_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_areas_code ON public.checklist_areas USING btree (area_code);


--
-- Name: idx_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_category ON public.checklist_items USING btree (category_id);


--
-- Name: idx_category_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_category_date ON public.checklist_results USING btree (category_id, date_key);


--
-- Name: idx_checklist_results_conveyor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_checklist_results_conveyor ON public.checklist_results USING btree (conveyor);


--
-- Name: idx_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_code ON public.checklist_categories USING btree (category_code);


--
-- Name: idx_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_date ON public.checklist_signatures USING btree (date_key);


--
-- Name: idx_date_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_date_status ON public.checklist_results USING btree (date_key, status);


--
-- Name: idx_gauge_checkpoint_results_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gauge_checkpoint_results_lookup ON public.gauge_checkpoint_results USING btree (gauge_id, date_key, shift);


--
-- Name: idx_gauge_checkpoint_results_nik; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gauge_checkpoint_results_nik ON public.gauge_checkpoint_results USING btree (nik);


--
-- Name: idx_gauge_checkpoints_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gauge_checkpoints_type ON public.gauge_checkpoints USING btree (gauge_type, is_active);


--
-- Name: idx_gauge_inspections_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gauge_inspections_lookup ON public.gauge_inspections USING btree (gauge_id, date_key, shift);


--
-- Name: idx_gauge_qr_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gauge_qr_active ON public.gauge_qr_codes USING btree (is_active);


--
-- Name: idx_gauge_qr_area_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gauge_qr_area_type ON public.gauge_qr_codes USING btree (area_type);


--
-- Name: idx_gauge_qr_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gauge_qr_type_id ON public.gauge_qr_codes USING btree (gauge_type_id);


--
-- Name: idx_gauge_types_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gauge_types_area ON public.gauge_types USING btree (area_type, is_active);


--
-- Name: idx_gauge_types_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gauge_types_slug ON public.gauge_types USING btree (gauge_type_slug);


--
-- Name: idx_items_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_area ON public.checklist_items USING btree (area_id);


--
-- Name: idx_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lookup ON public.checklist_history USING btree (date_key, category_id, item_id);


--
-- Name: idx_mapping_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mapping_active ON public.carline_line_mapping USING btree (user_id, category_code, is_active);


--
-- Name: idx_mapping_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mapping_category ON public.carline_line_mapping USING btree (category_code);


--
-- Name: idx_mapping_conveyor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mapping_conveyor ON public.carline_line_mapping USING btree (conveyor);


--
-- Name: idx_mapping_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mapping_user ON public.carline_line_mapping USING btree (user_id);


--
-- Name: idx_mapping_user_category_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mapping_user_category_active ON public.carline_line_mapping USING btree (user_id, category_code, is_active);


--
-- Name: idx_results_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_results_area ON public.checklist_results USING btree (area_id);


--
-- Name: idx_results_area_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_results_area_lookup ON public.checklist_results USING btree (category_id, area_id, date_key);


--
-- Name: idx_results_carline; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_results_carline ON public.checklist_results USING btree (carline);


--
-- Name: idx_results_carline_line; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_results_carline_line ON public.checklist_results USING btree (carline, line);


--
-- Name: idx_results_line; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_results_line ON public.checklist_results USING btree (line);


--
-- Name: idx_results_specific_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_results_specific_area ON public.checklist_results USING btree (specific_area);


--
-- Name: idx_shift; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shift ON public.checklist_items USING btree (shift);


--
-- Name: idx_signatures_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_signatures_area ON public.checklist_signatures USING btree (area_id);


--
-- Name: idx_signatures_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_signatures_unique ON public.checklist_signatures USING btree (user_id, category_id, date_key, shift, COALESCE(area_id, '-1'::integer));


--
-- Name: idx_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_type ON public.checklist_categories USING btree (table_type);


--
-- Name: idx_user_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_category ON public.checklist_signatures USING btree (user_id, category_id);


--
-- Name: idx_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_date ON public.checklist_results USING btree (user_id, date_key);


--
-- Name: idx_users_department; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_department ON public.users USING btree (department);


--
-- Name: idx_users_nik; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_nik ON public.users USING btree (nik);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: unique_signature_per_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unique_signature_per_area ON public.checklist_signatures USING btree (user_id, category_id, date_key, shift, COALESCE(area_id, '-1'::integer));


--
-- Name: carline_line_mapping update_carline_line_mapping_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_carline_line_mapping_updated_at BEFORE UPDATE ON public.carline_line_mapping FOR EACH ROW EXECUTE FUNCTION public.update_carline_line_mapping_updated_at();


--
-- Name: carline_line_mapping carline_line_mapping_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carline_line_mapping
    ADD CONSTRAINT carline_line_mapping_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: checklist_areas checklist_areas_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_areas
    ADD CONSTRAINT checklist_areas_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.checklist_categories(id) ON DELETE CASCADE;


--
-- Name: checklist_items checklist_items_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_items
    ADD CONSTRAINT checklist_items_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.checklist_areas(id) ON DELETE SET NULL;


--
-- Name: checklist_items checklist_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_items
    ADD CONSTRAINT checklist_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.checklist_categories(id) ON DELETE CASCADE;


--
-- Name: checklist_results checklist_results_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_results
    ADD CONSTRAINT checklist_results_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.checklist_areas(id) ON DELETE SET NULL;


--
-- Name: checklist_results checklist_results_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_results
    ADD CONSTRAINT checklist_results_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.checklist_categories(id) ON DELETE CASCADE;


--
-- Name: checklist_results checklist_results_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_results
    ADD CONSTRAINT checklist_results_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.checklist_items(id) ON DELETE CASCADE;


--
-- Name: checklist_results checklist_results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_results
    ADD CONSTRAINT checklist_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: checklist_signatures checklist_signatures_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_signatures
    ADD CONSTRAINT checklist_signatures_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.checklist_areas(id) ON DELETE SET NULL;


--
-- Name: checklist_signatures checklist_signatures_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_signatures
    ADD CONSTRAINT checklist_signatures_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.checklist_categories(id) ON DELETE CASCADE;


--
-- Name: checklist_signatures checklist_signatures_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_signatures
    ADD CONSTRAINT checklist_signatures_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: gauge_checkpoint_results gauge_checkpoint_results_checkpoint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauge_checkpoint_results
    ADD CONSTRAINT gauge_checkpoint_results_checkpoint_id_fkey FOREIGN KEY (checkpoint_id) REFERENCES public.gauge_checkpoints(id);


--
-- Name: gauge_checkpoint_results gauge_checkpoint_results_gauge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauge_checkpoint_results
    ADD CONSTRAINT gauge_checkpoint_results_gauge_id_fkey FOREIGN KEY (gauge_id) REFERENCES public.gauges(id);


--
-- Name: gauge_inspections gauge_inspections_gauge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauge_inspections
    ADD CONSTRAINT gauge_inspections_gauge_id_fkey FOREIGN KEY (gauge_id) REFERENCES public.gauges(id);


--
-- Name: gauge_inspections gauge_inspections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauge_inspections
    ADD CONSTRAINT gauge_inspections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gauges gauges_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauges
    ADD CONSTRAINT gauges_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.checklist_areas(id);


--
-- Name: gauges gauges_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gauges
    ADD CONSTRAINT gauges_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.checklist_categories(id);


--
-- PostgreSQL database dump complete
--

\unrestrict SRdX345XFCiCMORRks2bqkvZjbDPZxffmHfLfWedCaHEeC8UQ1cPGUFl6JQAG3z

