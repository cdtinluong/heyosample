--
-- PostgreSQL database dump
--

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: FileAction; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "FileAction" AS ENUM (
    'CREATED',
    'UPDATED',
    'DOWNLOADED',
    'DELETED',
    'RECOVERED'
);

--
-- Name: FilePermission; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "FilePermission" AS ENUM (
    'READ_WRITE',
    'READ_COMMENT',
    'READ_ONLY'
);

--
-- Name: FileStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "FileStatus" AS ENUM (
    'OPENED',
    'CLOSED',
    'TRASHED',
    'UPLOADING',
    'UPLOADED',
    'ABORTED',
    'FAILED',
    'TRASHED_PERMANENTLY',
    'ACTIVE'
);

--
-- Name: HierarchyAction; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "HierarchyAction" AS ENUM (
    'CREATED',
    'UPDATED',
    'DELETED',
    'RECOVERED'
);

--
-- Name: MigrationStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "MigrationStatus" AS ENUM (
    'STARTED',
    'ABORTED',
    'COMPLETED',
    'PAUSED',
    'ONGOING',
    'PENDING'
);

--
-- Name: OrgAction; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "OrgAction" AS ENUM (
    'USER_ADDED',
    'USER_DELETED',
    'CREATED',
    'UPDATED',
    'DELETED'
);

--
-- Name: Role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "Role" AS ENUM (
    'ADMIN',
    'MEMBER',
    'COLLABORATOR'
);

--
-- Name: UserAction; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "UserAction" AS ENUM (
    'CREATED',
    'UPDATED',
    'DELETED',
    'LOGIN',
    'LOGOUT'
);

--
-- Name: add_file_history(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION add_file_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  action "FileAction";
BEGIN
    action := TG_ARGV[0];
    IF NEW.delete_at IS NOT NULL then
        action:= 'DELETED';
    END IF;

    IF OLD.delete_at IS NOT NULL and NEW.delete_at IS NULL then
        action:= 'RECOVERED';
    END IF;

    INSERT INTO "FileHistory"
        (id, "file_id", "user_id", "device_id", "filename", "version", "size", "action", "has_conflict") VALUES
        (uuid_generate_v4(), NEW.id, NEW.user_id, NEW.device_id, NEW.name, NEW.version, NEw.size, action, NEW.has_conflict);

    RETURN NEW;
END;
$$;

--
-- Name: add_hierarchy_history(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION add_hierarchy_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  action "HierarchyAction";
BEGIN
    action := TG_ARGV[0];
    IF NEW.delete_at IS NOT NULL then
        action:= 'DELETED';
    END IF;

    IF OLD.delete_at IS NOT NULL and NEW.delete_at IS NULL then
        action:= 'RECOVERED';
    END IF;

    INSERT INTO "HierarchyHistory"
        (id, "requester_id", "file_id", "hierarchy_id", "old_path", "new_path", "action", "device_id") VALUES
        (uuid_generate_v4(), NEW."user_id", NEW.file_id, NEW.id, OLD.path, NEW.path, action, NEW.device_id);

    RETURN NEW;
END;
$$;

--
-- Name: add_user_history(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION add_user_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  action "UserAction";
BEGIN

    action := TG_ARGV[0];

    IF NEW.delete_at IS NOT NULL then
        action := 'DELETED';
    END IF;

    IF action = 'CREATED' then
        INSERT INTO "Hierarchy"
            (id, user_id, "path", device_id) VALUES
            (uuid_generate_v4(), NEW.id, '/', NEW.device_id);
    END IF;

    -- No need to include OLD here since we keep history of everything
    INSERT INTO "UserHistory"
        (id, user_id, action, details, device_id) VALUES
        (uuid_generate_v4(), NEW.id, action, to_jsonb(NEW), NEW.device_id);

    RETURN NEW;
END;
$$;

--
-- Name: File; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "File" (
    id uuid NOT NULL,
    user_id uuid,
    organization_id uuid NOT NULL,
    name character varying(150) NOT NULL,
    size bigint NOT NULL,
    checksum character varying(255) NOT NULL,
    version integer NOT NULL,
    status "FileStatus" NOT NULL,
    has_conflict boolean DEFAULT false NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    delete_at timestamp(3) with time zone,
    device_id character varying(100) NOT NULL
);

--
-- Name: FileContent; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "FileContent" (
    id uuid NOT NULL,
    file_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    size bigint NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status "FileStatus" NOT NULL
);

--
-- Name: FileHistory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "FileHistory" (
    id uuid NOT NULL,
    file_id uuid NOT NULL,
    user_id uuid NOT NULL,
    device_id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    version integer NOT NULL,
    size bigint NOT NULL,
    action "FileAction" NOT NULL,
    has_conflict boolean DEFAULT false NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: FileUser; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "FileUser" (
    user_id uuid NOT NULL,
    file_id uuid NOT NULL,
    permission "FilePermission" NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: FileUserHistory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "FileUserHistory" (
    id uuid NOT NULL,
    requester_id uuid NOT NULL,
    file_id uuid NOT NULL,
    action "FileAction" NOT NULL,
    details jsonb,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: Hierarchy; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "Hierarchy" (
    id uuid NOT NULL,
    file_id uuid,
    path text NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id uuid NOT NULL,
    delete_at timestamp(3) with time zone,
    device_id character varying(100) NOT NULL,
    status "FileStatus" NOT NULL
);

--
-- Name: HierarchyHistory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "HierarchyHistory" (
    id text NOT NULL,
    requester_id uuid NOT NULL,
    file_id uuid,
    old_path text,
    new_path text NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hierarchy_id uuid NOT NULL,
    action "HierarchyAction" DEFAULT 'CREATED'::"HierarchyAction" NOT NULL,
    device_id character varying(100) NOT NULL
);

--
-- Name: Organization; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "Organization" (
    id uuid NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: OrganizationHistory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "OrganizationHistory" (
    id uuid NOT NULL,
    requester_id uuid,
    organization_id uuid,
    action "OrgAction" NOT NULL,
    details jsonb,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: Plan; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "Plan" (
    id uuid NOT NULL,
    external_id character varying(150) NOT NULL,
    options jsonb NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "User" (
    id uuid NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    delete_at timestamp(3) with time zone,
    device_id character varying(100) DEFAULT 'no-device-id'::character varying NOT NULL,
    migration_status "MigrationStatus"
);

--
-- Name: UserHistory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "UserHistory" (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    action "UserAction" NOT NULL,
    details jsonb,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    device_id character varying(100) NOT NULL
);

--
-- Name: UserPlan; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "UserPlan" (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    transaction_id character varying(150) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expire_at timestamp(3) with time zone
);

--
-- Name: UserUsage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "UserUsage" (
    user_id uuid NOT NULL,
    nb_file smallint,
    total_file_size bigint
);

--
-- Name: UsersOnOrganizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "UsersOnOrganizations" (
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    role "Role" NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: FileContent FileContent_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "FileContent"
    ADD CONSTRAINT "FileContent_pkey" PRIMARY KEY (id);


--
-- Name: FileHistory FileHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "FileHistory"
    ADD CONSTRAINT "FileHistory_pkey" PRIMARY KEY (id);


--
-- Name: FileUserHistory FileUserHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "FileUserHistory"
    ADD CONSTRAINT "FileUserHistory_pkey" PRIMARY KEY (id);


--
-- Name: FileUser FileUser_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "FileUser"
    ADD CONSTRAINT "FileUser_pkey" PRIMARY KEY (user_id, file_id);


--
-- Name: File File_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "File"
    ADD CONSTRAINT "File_pkey" PRIMARY KEY (id);


--
-- Name: HierarchyHistory HierarchyHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "HierarchyHistory"
    ADD CONSTRAINT "HierarchyHistory_pkey" PRIMARY KEY (id);


--
-- Name: Hierarchy Hierarchy_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "Hierarchy"
    ADD CONSTRAINT "Hierarchy_pkey" PRIMARY KEY (id);


--
-- Name: OrganizationHistory OrganizationHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "OrganizationHistory"
    ADD CONSTRAINT "OrganizationHistory_pkey" PRIMARY KEY (id);


--
-- Name: Organization Organization_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "Organization"
    ADD CONSTRAINT "Organization_pkey" PRIMARY KEY (id);


--
-- Name: Plan Plan_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "Plan"
    ADD CONSTRAINT "Plan_pkey" PRIMARY KEY (id);


--
-- Name: UserHistory UserHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "UserHistory"
    ADD CONSTRAINT "UserHistory_pkey" PRIMARY KEY (id);


--
-- Name: UserPlan UserPlan_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "UserPlan"
    ADD CONSTRAINT "UserPlan_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: UsersOnOrganizations UsersOnOrganizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "UsersOnOrganizations"
    ADD CONSTRAINT "UsersOnOrganizations_pkey" PRIMARY KEY (user_id, organization_id);


--
-- Name: File_delete_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "File_delete_at_idx" ON "File" USING btree (delete_at);


--
-- Name: Hierarchy_file_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Hierarchy_file_id_key" ON "Hierarchy" USING btree (file_id);


--
-- Name: Hierarchy_path_user_id_delete_at_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Hierarchy_path_user_id_delete_at_key" ON "Hierarchy" USING btree (path, user_id, COALESCE(delete_at, '1970-01-01 00:00:00+00'::timestamp with time zone));


--
-- Name: Organization_is_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Organization_is_active_idx" ON "Organization" USING btree (is_active);


--
-- Name: UserHistory_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "UserHistory_created_at_idx" ON "UserHistory" USING btree (created_at);


--
-- Name: UserPlan_is_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "UserPlan_is_active_idx" ON "UserPlan" USING btree (is_active);


--
-- Name: UserUsage_user_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "UserUsage_user_id_key" ON "UserUsage" USING btree (user_id);


--
-- Name: User_delete_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_delete_at_idx" ON "User" USING btree (delete_at);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree (email);


--
-- Name: User_is_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_is_active_idx" ON "User" USING btree (is_active);


--
-- Name: File user_after_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER user_after_insert AFTER INSERT ON "File" FOR EACH ROW EXECUTE FUNCTION add_file_history('CREATED');


--
-- Name: Hierarchy user_after_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER user_after_insert AFTER INSERT ON "Hierarchy" FOR EACH ROW EXECUTE FUNCTION add_hierarchy_history('CREATED');


--
-- Name: User user_after_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER user_after_insert AFTER INSERT ON "User" FOR EACH ROW EXECUTE FUNCTION add_user_history('CREATED');


--
-- Name: File user_after_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER user_after_update AFTER UPDATE ON "File" FOR EACH ROW EXECUTE FUNCTION add_file_history('UPDATED');


--
-- Name: Hierarchy user_after_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER user_after_update AFTER UPDATE ON "Hierarchy" FOR EACH ROW EXECUTE FUNCTION add_hierarchy_history('UPDATED');


--
-- Name: User user_after_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER user_after_update AFTER UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION add_user_history('UPDATED');


--
-- Name: FileContent FileContent_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "FileContent"
    ADD CONSTRAINT "FileContent_file_id_fkey" FOREIGN KEY (file_id) REFERENCES "File"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FileHistory FileHistory_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "FileHistory"
    ADD CONSTRAINT "FileHistory_file_id_fkey" FOREIGN KEY (file_id) REFERENCES "File"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FileHistory FileHistory_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "FileHistory"
    ADD CONSTRAINT "FileHistory_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FileUserHistory FileUserHistory_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "FileUserHistory"
    ADD CONSTRAINT "FileUserHistory_file_id_fkey" FOREIGN KEY (file_id) REFERENCES "File"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FileUserHistory FileUserHistory_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "FileUserHistory"
    ADD CONSTRAINT "FileUserHistory_requester_id_fkey" FOREIGN KEY (requester_id) REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FileUser FileUser_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "FileUser"
    ADD CONSTRAINT "FileUser_file_id_fkey" FOREIGN KEY (file_id) REFERENCES "File"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FileUser FileUser_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "FileUser"
    ADD CONSTRAINT "FileUser_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: File File_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "File"
    ADD CONSTRAINT "File_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: File File_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "File"
    ADD CONSTRAINT "File_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HierarchyHistory HierarchyHistory_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "HierarchyHistory"
    ADD CONSTRAINT "HierarchyHistory_file_id_fkey" FOREIGN KEY (file_id) REFERENCES "File"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HierarchyHistory HierarchyHistory_hierarchy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "HierarchyHistory"
    ADD CONSTRAINT "HierarchyHistory_hierarchy_id_fkey" FOREIGN KEY (hierarchy_id) REFERENCES "Hierarchy"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HierarchyHistory HierarchyHistory_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "HierarchyHistory"
    ADD CONSTRAINT "HierarchyHistory_requester_id_fkey" FOREIGN KEY (requester_id) REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Hierarchy Hierarchy_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "Hierarchy"
    ADD CONSTRAINT "Hierarchy_file_id_fkey" FOREIGN KEY (file_id) REFERENCES "File"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Hierarchy Hierarchy_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "Hierarchy"
    ADD CONSTRAINT "Hierarchy_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrganizationHistory OrganizationHistory_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "OrganizationHistory"
    ADD CONSTRAINT "OrganizationHistory_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OrganizationHistory OrganizationHistory_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "OrganizationHistory"
    ADD CONSTRAINT "OrganizationHistory_requester_id_fkey" FOREIGN KEY (requester_id) REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: UserHistory UserHistory_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "UserHistory"
    ADD CONSTRAINT "UserHistory_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserPlan UserPlan_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "UserPlan"
    ADD CONSTRAINT "UserPlan_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES "Plan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserPlan UserPlan_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "UserPlan"
    ADD CONSTRAINT "UserPlan_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserUsage UserUsage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "UserUsage"
    ADD CONSTRAINT "UserUsage_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UsersOnOrganizations UsersOnOrganizations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "UsersOnOrganizations"
    ADD CONSTRAINT "UsersOnOrganizations_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UsersOnOrganizations UsersOnOrganizations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "UsersOnOrganizations"
    ADD CONSTRAINT "UsersOnOrganizations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE;
